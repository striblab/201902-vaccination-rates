// Dependencies
const csvParse = require('csv-parse/lib/sync');
const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');
const ss = require('simple-statistics');

// Common headers
const commonHeaders = {
  hepB: [
    'hepBVac',
    'hepBPartial',
    'hepBNoDoses',
    'hepBNonMedical',
    'hepBMedical'
  ],
  dtap: [
    'dtapVac',
    'dtapPartial',
    'dtapNoDoses',
    'dtapNonMedical',
    'dtapMedical'
  ],
  polio: [
    'polioVac',
    'polioPartial',
    'polioNoDoses',
    'polioNonMedical',
    'polioMedical'
  ],
  hib: ['hibVac', 'hibNoDoses', 'hibNonMedical', 'hibMedical'],
  mmr: ['mmrVac', 'mmrPartial', 'mmrNoDoses', 'mmrNonMedical', 'mmrMedical'],
  varicella: [
    'varicellaVac',
    'varicellaNoDoses',
    'varicellaHistory',
    'varicellaNonMedical',
    'varicellaMedical'
  ],
  hepA: ['hepAVac', 'hepANoDoses', 'hepANonMedical', 'hepAMedical']
};
const allCommonHeaders = _.reduce(
  commonHeaders,
  (m, v) => {
    return m.concat(v);
  },
  []
);

// Compile data
function compileData() {
  // Daycares (child care centers)
  let licensing = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sources', 'childcare_vax.json'))
  );
  let daycares = csvParse(
    fs.readFileSync(path.join(__dirname, 'sources', 'child-care-centers.csv')),
    {
      cast: true,
      from_line: 8,
      columns: ['license', 'name', 'city', 'enrollment']
        .concat(commonHeaders.hepB)
        .concat(commonHeaders.dtap)
        .concat(commonHeaders.polio)
        .concat(commonHeaders.hib)
        .concat(alterSplice(commonHeaders.mmr, 1, 1))
        .concat(commonHeaders.varicella)
        .concat(commonHeaders.hepA)
        .concat(['blankColumn01'])
    }
  );

  // Get school data
  let originalData = require('./sources/schools_vax.json');

  // Standardize school data
  let schools = _.map(originalData, d => {
    return {
      //districtId: d.iddis,
      district: d.disname,
      //name: d.schname,
      // orgidmde: '012396100000',
      //enrollment: parseInt(d.enroll, 10),
      //complete_dtap: 52,
      dtapVac: d.complete_pert_dtap,
      //inprogress_dtap: 3,
      dtapPartialNoDoses: d.inprogress_pert_dtap,
      //co_dtap: 3,
      dtapNonMedical: d.co_pert_dtap,
      //me_dtap: 0,
      dtapMedical: d.me_pert_dtap,
      //complete_pol: 52,
      polioVac: d.complete_pert_pol,
      //inprogress_pol: 3,
      polioPartialNoDoses: d.inprogress_pert_pol,
      //co_pol: 3,
      polioNonMedical: d.co_pert_pol,
      //me_pol: 0,
      polioMedical: d.me_pert_pol,
      //complete_mmr: 52,
      mmrVac: d.complete_pert_mmr,
      //inprogress_mmr: 3,
      mmrPartialNoDoses: d.inprogress_pert_mmr,
      //co_mmr: 3,
      mmrNonMedical: d.co_pert_mmr,
      //me_mmr: 0,
      mmrMedical: d.me_pert_mmr,
      //complete_hepb: 53,
      hepBVac: d.complete_pert_hepb,
      //inprogress_hepb: 3,
      hepBPartialNoDoses: d.inprogress_pert_hepb,
      //co_hepb: 2,
      hepBNonMedical: d.co_pert_hepb,
      //me_hepb: 0,
      hepBMedical: d.me_pert_hepb,
      //complete_var: 53,
      varicellaVac: d.complete_pert_var,
      //inprogress_var: 3,
      varicellaPartialNoDoses: d.inprogress_pert_var,
      // ?? disease_hist_var: 0,
      // ?? d.diseasehist_pert_var: 0,
      //co_var: 2,
      varicellaNonMedical: d.co_pert_var,
      //me_var: 0,
      varicellaMedical: d.me_pert_var,
      enrollment: d.enroll_new,
      id: d.schoolID,
      grade: d.grade === 'Kindergarten' ? 'kindergarten' : '7th-grade',
      type: 'schools',
      year: d.yr,
      //schoolYear: '2017-18',
      districtId: d.districtid,
      districtType: d.districttype,
      name: d.school_name || toTitleCase(cleanString(d.schname)),
      city: d.physical_city,
      county: d.county,
      grades: cleanString(d.grades),
      classification: d.school_classification,
      schoolType: d.schooltype,
      schoolTypeOther: d.type2,
      //datayear: '17-18',
      k12Enrollment: d.k12enr,
      //freek12: 105,
      //redk12: 37,
      reducedFreeLunch: d.pctpoverty,
      incomeCategory: d.income_bucket,
      //total_students: 310,
      //total_minority: 36,
      minority: d.pctminority,
      diversityCategory: d.diversity_bucket,
      mmrLow: d.mmr_pocket.match(/^no$/i)
        ? false
        : d.mmr_pocket.match(/^yes$/i)
          ? true
          : undefined,
      exlusion: d.mmr_pocket.match(/not reported/i)
        ? 'not-reporting'
        : undefined
    };
  });

  // Filter daycares that are licensed
  let preFilterLength = daycares.length;
  daycares = _.filter(daycares, d => {
    return _.find(licensing, l => {
      return l.license_num === d.license.toString();
    });
  });
  console.warn(
    `Licensing data count: ${licensing.length} | Filtered daycare lenth: ${
      daycares.length
    }`
  );
  console.warn(`Filtered ${preFilterLength - daycares.length} daycares.`);

  // Get some info from the licensing data
  daycares = _.map(daycares, d => {
    let f = _.find(licensing, l => {
      return l.license_num === d.license.toString();
    });

    if (f && (f.address_line1 || f.address_line2)) {
      d.address = _.filter([f.address_line1, f.address_line2]).join(', ');
    }

    return d;
  });

  // Add some data
  daycares = _.map(daycares, d => {
    d.type = 'child-care-centers';
    d.year = 2018;
    return d;
  });

  // Alter some specific data
  schools = _.map(schools, d => {
    d.district = toTitleCase(cleanString(d.district));
    return d;
  });

  daycares = _.map(daycares, d => {
    d.name = cleanString(d.name);
    d.city = cleanString(d.city);
    return d;
  });

  // Combine data
  let locations = [].concat(daycares).concat(schools);

  // Standardize footnotes
  locations = _.map(locations, c => {
    if (!c.enrollment || !_.isString(c.enrollment)) {
      return c;
    }

    c.exclusion = c.enrollment.match(/not\sreport/i)
      ? 'no-reporting'
      : c.enrollment.match(/no\s+children.*24.*months/i)
        ? 'no-enrollment'
        : c.enrollment.match(/enrollment.*<.*[0-9]+/i)
          ? 'low-enrollment'
          : undefined;

    return c;
  });
  console.warn(
    `Rows that have a string enrollment but no exclusion: ${
      _.filter(locations, l => {
        return _.isString(l.enrollment) && !l.exclusion;
      }).length
    }`
  );
  console.warn(
    `Rows that an exclusion: ${_.filter(locations, l => l.exclusion).length}`
  );

  // Sort
  locations = _.sortBy(locations, 'name');

  // Add id
  locations = _.map(locations, (l, i) => {
    l.id = l.id || i.toString();
    return l;
  });

  // Filter out statewide
  locations = _.filter(locations, l => {
    if (!l.name) {
      console.warn(`No name for record: ${l.id}`);
    }
    return !l.name.match(/statewide/i);
  });

  // Cleanup a bit
  locations = _.map(locations, l => {
    // Don't need
    l = _.omit(l, ['blankColumn01']);
    // Make sure numbers
    allCommonHeaders.forEach(h => {
      if (!_.isNumber(l[h])) {
        delete l[h];
      }
      else {
        l[h] = Math.round(l[h] * 10000) / 10000;
      }
    });

    return l;
  });

  // Data we are not actually using
  let unnecessaryFields = [
    'license',
    'county',
    'districtId',
    'districtType',
    'reducedFreeLunch',
    'incomeCategory',
    'minority'
  ];
  locations = _.map(locations, l => {
    l = _.omit(l, unnecessaryFields);

    // Don't use non vac numbers
    Object.keys(commonHeaders).forEach(v => {
      if (v !== 'mmr') {
        _.each(l, (f, k) => {
          if (k.indexOf(v) === 0 && k !== `${v}Vac`) {
            delete l[k];
          }
        });
      }
    });

    return l;
  });

  // Group by location, grade, and by year
  let locationFields = [
    'district',
    'id',
    'name',
    'address',
    'grades',
    'classification',
    'schoolType',
    'schoolTypeOther',
    'type',
    'k12Enrollment',
    'city'
  ];
  locations = _.map(_.groupBy(locations, 'id'), s => {
    let school = _.pick(s[0], locationFields);
    school.grades = _.map(_.groupBy(s, g => g.grade || 'all'), (g, gi) => {
      return {
        grade: gi,
        years: _.orderBy(
          _.map(g, y => {
            return _.omit(y, locationFields);
          }),
          ['year'],
          ['desc']
        )
      };
    });

    return school;
  });

  return locations;
}

// Splice to return altered array
function alterSplice(input, begin, length) {
  let i = _.cloneDeep(input);
  i.splice(begin, length);
  return i;
}

// Stats
function stats() {
  let locations = compileData();

  // Make aggregate data
  let stats = {};
  _.each(
    {
      'child-care-centers--all--2018--mmrVac': d => {
        let grade = _.find(d.grades, { grade: 'all' });
        let year = _.find(grade ? grade.years : undefined, { year: 2018 });
        return d.type === 'child-care-centers' && grade && year
          ? year.mmrVac
          : undefined;
      },
      'schools--kindergarten--2018--mmrVac': d => {
        let grade = _.find(d.grades, { grade: 'kindergarten' });
        let year = _.find(grade ? grade.years : undefined, { year: 2018 });
        return d.type === 'schools' && grade && year ? year.mmrVac : undefined;
      },
      'schools--7th-grade--2018--mmrVac': d => {
        let grade = _.find(d.grades, { grade: '7th-grade' });
        let year = _.find(grade ? grade.years : undefined, { year: 2018 });
        return d.type === 'schools' && grade && year ? year.mmrVac : undefined;
      }
    },
    (fData, f) => {
      let s = _.filter(_.map(locations, fData), d => _.isNumber(d));

      // Top level stats
      stats[f] = stats[f] || {};
      stats[f].count = s.length;
      stats[f].min = ss.min(s);
      stats[f].max = ss.max(s);
      stats[f].median = ss.median(s);
      stats[f].mean = ss.mean(s);
      stats[f].std = ss.standardDeviation(s);

      // Histogram numbers
      let bins = Math.min(Math.max(Math.ceil(Math.sqrt(s.length)), 12), 20);
      let rawInterval = Math.abs((stats[f].max - stats[f].min) / bins);

      // Manually define;
      bins = 20;
      rawInterval = 0.05;

      let interval = parseFloat(rawInterval.toPrecision(1));
      let intervalMin = parseFloat(stats[f].min.toPrecision(1));

      // Manually define
      interval = 0.05;
      intervalMin = 0;

      let histogram = [];
      let max = intervalMin + interval;
      let min = intervalMin;
      while (max <= stats[f].max) {
        histogram.push({
          min,
          max,
          count: _.filter(s, d => {
            return d >= min && d < max;
          }).length
        });

        min = max;
        max = min + interval;
      }

      // Last bin
      histogram.push({
        min,
        max,
        count: _.filter(s, d => {
          return d >= min && d < max;
        }).length
      });

      stats[f].histogram = histogram;
    }
  );

  return stats;
}

// Stupid title case function
// https://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
function toTitleCase(input) {
  let i;
  let j;
  let str;
  let lowers;
  let uppers;

  if (!_.isString(input)) {
    return undefined;
  }

  str = input.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });

  // Certain minor words should be left lowercase unless
  // they are the first or last words in the string
  lowers = [
    'A',
    'An',
    'The',
    'And',
    'But',
    'Or',
    'For',
    'Nor',
    'As',
    'At',
    'By',
    'For',
    'From',
    'In',
    'Into',
    'Near',
    'Of',
    'On',
    'Onto',
    'To',
    'With'
  ];
  for (i = 0, j = lowers.length; i < j; i++)
    str = str.replace(new RegExp('\\s' + lowers[i] + '\\s', 'gi'), function(
      txt
    ) {
      return txt.toLowerCase();
    });

  // Certain words such as initialisms or acronyms should be left uppercase
  uppers = ['Id', 'Tv', 'ii', 'iii', 'iv', 'v', 'vi', 'iq', 'jw'];
  for (i = 0, j = uppers.length; i < j; i++)
    str = str.replace(
      new RegExp('\\b' + uppers[i] + '\\b', 'gi'),
      uppers[i].toUpperCase()
    );

  return str;
}

// Common fixes
function nameFixes(input) {
  return input.replace(/([^\W_]+[^\s-]*) */g, function(txt) {
    return txt
      .replace(/^elem\.?(\s*)$/i, 'Elementary$1')
      .replace(/^el\.?(\s*)$/i, 'Elementary$1')
      .replace(/^sch\.?(\s*)$/i, 'School$1')
      .replace(/^m\.w\.(\s*)$/i, 'M.W.$1');
  });
}

// Clean excel strings
function cleanString(input) {
  return input && input.match
    ? input
      .replace(/[\s\r\n]+/g, ' ')
      .replace(/(_?x000d_?)+/gi, ' ')
      .trim()
    : input;
}

// Build data config
module.exports = {
  locations: {
    data: compileData(),
    local: 'locations.json'
  },
  stats: {
    data: stats(),
    local: 'stats.json'
  }
};
