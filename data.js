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

// Compile data
function compileData() {
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
  let kindergartens = csvParse(
    fs.readFileSync(path.join(__dirname, 'sources', 'kindergartens.csv')),
    {
      cast: true,
      from_line: 10,
      columns: ['district', 'name', 'enrollment']
        .concat(alterSplice(commonHeaders.dtap, 2, 1))
        .concat(alterSplice(commonHeaders.polio, 2, 1))
        .concat(alterSplice(commonHeaders.mmr, 2, 1))
        .concat(alterSplice(commonHeaders.hepB, 2, 1))
        .concat(commonHeaders.varicella)
        .concat(['blankColumn01'])
    }
  );

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

  // Add some data
  daycares = _.map(daycares, d => {
    d.type = 'child-care-centers';
    return d;
  });
  kindergartens = _.map(kindergartens, d => {
    d.type = 'kindergarten';
    return d;
  });

  // Alter some specific data
  kindergartens = _.map(kindergartens, d => {
    d.name = nameFixes(toTitleCase(d.name));
    d.district = toTitleCase(d.district);
    return d;
  });

  // Combine data
  let locations = [].concat(daycares).concat(kindergartens);

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
    l.id = i.toString();
    return l;
  });

  // Filter out statewide
  locations = _.filter(locations, l => {
    return !l.name.match(/statewide/i);
  });

  // Cleanup a bit
  locations = _.map(locations, l => {
    return _.omit(l, ['blankColumn01']);
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
    ['mmrVac', 'dtapVac', 'hibVac', 'polioVac', 'hepBVac', 'hepAVac'],
    f => {
      let s = _.filter(_.map(locations, f), d => _.isNumber(d));

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
  uppers = ['Id', 'Tv', 'ii', 'iii', 'iv', 'v', 'vi'];
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
      .replace(/^el\.?(\s*)$/i, 'Elementary$1')
      .replace(/^sch\.?(\s*)$/i, 'School$1');
  });
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
