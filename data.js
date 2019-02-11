// Dependencies
const csvParse = require('csv-parse/lib/sync');
const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');

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
function compile() {
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
  kindergartens = _.map(daycares, d => {
    d.type = 'kindergarten';
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

  // Cleanup a bit
  locations = _.omit(locations, 'blankColumn01');

  return locations;
}

// Splice to return altered array
function alterSplice(input, begin, length) {
  let i = _.cloneDeep(input);
  i.splice(begin, length);
  return i;
}

// Build data config
module.exports = {
  locations: {
    data: compile()
  }
};
