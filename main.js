
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

async function loadDataset(path) {
  const raw = await d3.json(path);
  return { data: raw.data, sources: raw.sources, meta: raw.meta };
}
const datasets = {
  income: {
    2024: await loadDataset("./data/2024/income.json"),
    2025: await loadDataset("./data/2025/income.json"),
  },
  gst: {
    2024: await loadDataset("./data/2024/gst.json"),
    2025: await loadDataset("./data/2025/gst.json"),
  },
  corp: {
    2024: await loadDataset("./data/2024/corp.json"),
    2025: await loadDataset("./data/2025/corp.json"),
  },
  wealth: {
    2024: await loadDataset("./data/2024/wealth.json"),
    2025: await loadDataset("./data/2025/wealth.json"),
  },
  land: {
    2024: await loadDataset("./data/2024/land.json"),
    2025: await loadDataset("./data/2025/land.json"),
  },
  otherDirect: {
    2024: await loadDataset("./data/2024/otherdirect.json"),
    2025: await loadDataset("./data/2025/otherdirect.json"),
  },
  otherIndirect: {
    2024: await loadDataset("./data/2024/otherindirect.json"),
    2025: await loadDataset("./data/2025/otherindirect.json"),
  },
  nonTaxRevenue: {
    2024: await loadDataset("./data/2024/nontaxrevenue.json"),
    2025: await loadDataset("./data/2025/nontaxrevenue.json"),
  },
};

const availableYears = [2024, 2025];
let currentYear = 2025;

function yearEntryFor(type) {
  const years = datasets[type];
  return years[currentYear];
}
function datasetFor(type) {
  return yearEntryFor(type).data;
}
function sourcesFor(type) {
  return yearEntryFor(type).sources;
}
function metaFor(type) {
  return yearEntryFor(type).meta ?? {};
}

// Renders a dataset's recorded methodology/caveats into the given tab's
// assumptions box - called from each calculate*() alongside its draw*(). A
// dataset can cite more than one source (e.g. a figure cross-checked against
// a second publication) - each gets its own paragraph, in the order listed.
function drawAssumptions(containerId, type) {
  const paragraphs = d3.select(containerId)
    .selectAll("p")
    .data(sourcesFor(type));
  paragraphs.exit().remove();
  paragraphs.enter()
    .append("p")
    .merge(paragraphs)
    .text(d => d.assumptions);
}

const plans = (await d3.json("./data/tax_plans.json")).plans;
// Preprocces
plans.forEach(a => {
  a.isCustom = false;
  a.brackets.forEach((b, i) => {
    b.id = i;
  })
  a.wealthBrackets.forEach((b, i) => {
    b.id = i;
  })
});

let planCurrent = plans[3];

let data = {
  totals: {
    income: 0, gst: 0, corp: 0, other: metaFor("otherIndirect").otherIndirectResidual ?? 0,
    wealth: 0, land: 0, otherDirect: 0, otherIndirect: 0,
    nonTaxRevenue: 0
  },
  income: { brackets: [] },
  gst: [],
  corp: [],
  wealth: { brackets: [] },
  land: [],
  otherDirect: [],
  otherIndirect: [],
  nonTaxRevenue: []
};

// Main plot window.
const width = 800;
const height = 400;
const margin = 50;

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

const handleWidth = 12;

// Bracket tax types: a draggable-SVG-chart + editable table over a
// progressive bracket ladder (top + percent per bracket, bottom of each
// bracket implied by the previous bracket's top).
function createBracketPlot(type, containerId, xDomain) {
  const plot = d3
    .select(containerId)
    .append("svg")
    .attr("width", width + margin * 2)
    .attr("height", height + margin * 2)
    .append("g")
    .attr("transform", `translate(${margin}, ${margin})`);

  const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
  const yScaleRate = d3.scaleLinear().domain([0, 100]).range([height, 0]);
  const yScaleCount = d3.scaleLinear().domain([0, 1]).range([height, 0]);

  plot.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale));
  plot.append("g").attr("class", "y-axis").call(d3.axisLeft(yScaleRate));
  const yAxisCount = plot.append("g").attr("class", "y-axis").attr("transform", `translate(${width},0)`).call(d3.axisRight(yScaleCount));

  const dataContainer = plot.append("g").attr("class", "bracket-data-container");

  // Three persistent layers, appended once in this fixed order, so a newly
  // entered bracket's handle always paints above every bracket's rect -
  // rather than wherever it happens to land in append order. drawBracketChart
  // draws within these layers instead of nesting each bracket's rect/handles
  // in their own <g>, which let a later bracket's rect visually and
  // hit-test-wise cover an earlier bracket's shared-boundary handle.
  const rectLayer = plot.append("g").attr("class", "bracket-rect-layer");
  const topHandleLayer = plot.append("g").attr("class", "bracket-tophandle-layer");
  const rightHandleLayer = plot.append("g").attr("class", "bracket-righthandle-layer");

  // Created once per plot rather than on every drawBracketChart call - the
  // closures only capture `type`, which is fixed for this plot's lifetime.
  const dragUp = d3.drag().on("drag", function (event, d) {
    changeBracketPercent(type, d.id, yScaleRate.invert(event.y));
  });
  const dragRight = d3.drag().on("drag", function (event, d) {
    changeBracketRange(type, d.id, xScale.invert(event.x));
  });

  return {
    plot, xScale, yScaleRate, yScaleCount, yAxisCount, dataContainer,
    rectLayer, topHandleLayer, rightHandleLayer, dragUp, dragRight,
  };
}

// floor: implied bottom of bracket 0 (0 for income; wealth data includes
// negative net worth, so its ladder starts below zero)
const bracketConfig = {
  income: {
    datasetType: "income", bracketsField: "brackets", plotContainerId: "#plot-container",
    tableContainerId: "#income-bracket-table-container", addButtonId: "#income-bracket-add",
    assumptionsId: "#income-assumptions", xDomain: [0, 300], floor: 0, maxBrackets: 11, unitLabel: "K",
  },
  wealth: {
    datasetType: "wealth", bracketsField: "wealthBrackets", plotContainerId: "#wealth-plot-container",
    tableContainerId: "#wealth-bracket-table-container", addButtonId: "#wealth-bracket-add",
    assumptionsId: "#wealth-assumptions", xDomain: [-500, 12000], floor: -500, maxBrackets: 8, unitLabel: "K",
  },
};

const bracketPlots = {};
Object.entries(bracketConfig).forEach(([type, cfg]) => {
  bracketPlots[type] = createBracketPlot(type, cfg.plotContainerId, cfg.xDomain);
});

function drawBracketHistogram(type) {
  // Redraw the background distribution bars for the current year.
  const { datasetType } = bracketConfig[type];
  const { xScale, yScaleCount, yAxisCount, dataContainer } = bracketPlots[type];
  const dataset = datasetFor(datasetType);
  // Domain is the max *density* (count/width), matching what's actually
  // plotted below - using raw count here would badly under-scale bars for
  // datasets with uneven bin widths (e.g. wealth's $50K-$8.5M-wide bands).
  yScaleCount.domain([0, d3.max(dataset, d => d.count / (d.to - d.from))]);
  yAxisCount.call(d3.axisRight(yScaleCount));

  const dataSelection = dataContainer
    .selectAll(".bar")
    .data(dataset);

  dataSelection
    .enter()
    .append("rect")
    .attr("class", "bar")
    .merge(dataSelection)
    .attr("x", d => xScale(d.from))
    .attr("y", d => yScaleCount(d.count / (d.to - d.from)))
    .attr("width", d => xScale(d.to) - xScale(d.from))
    .attr("height", d => height - yScaleCount(d.count / (d.to - d.from)))
    .attr("fill", "lightblue");

  dataSelection.exit().remove();
}

// Draw total plot
const totalPlot = d3.select("#total-container")
  .append("svg")
  .attr("width", 200)
  .attr("height", 1000);

const totalXScale = d3.scaleBand()
  .range([0, 180])
  .padding(0.1);

const totalYScale = d3.scaleLinear()
  .range([900, 0]);

const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
totalPlot.append("g").attr("class", "y-axis").attr("transform", `translate(170,0)`).call(d3.axisRight(totalYScale));

// Draw plan dropdown
const dropdownContainer = d3.select("#dropdown-container");
const dropdown = dropdownContainer
  .append("select")
  .attr("id", "dropdown-menu")
  .on("change", function () {
    planCurrent = plans[this.value];
    recalculateAll();
  });

function drawDropdown() {
  // Redraw the select income tax plan dropdown
  const options = dropdown.selectAll("option").data(plans);

  options
    .enter()
    .append("option")
    .merge(options) // Merge enter and update selections
    .text(d => d.name) // Set display text
    .attr("value", (d, i) => i); // Set value

  dropdown.node().selectedIndex = plans.indexOf(planCurrent);
  options.exit().remove();
}

// Draw dataset-year dropdown
dropdownContainer.append("h2").text("Data year:");
const yearDropdown = dropdownContainer
  .append("select")
  .attr("id", "year-dropdown")
  .on("change", function () {
    currentYear = parseInt(this.value, 10);
    drawBracketHistogram("income");
    drawBracketHistogram("wealth");
    recalculateAll();
  });

function drawYearDropdown() {
  const options = yearDropdown.selectAll("option").data(availableYears);

  options
    .enter()
    .append("option")
    .merge(options)
    .text(d => d)
    .attr("value", d => d);

  yearDropdown.node().value = currentYear;
  options.exit().remove();
}

function calculateBracketTax(type) {
  // Should be called whenever this type's tax brackets changed.
  const { datasetType, bracketsField, floor, assumptionsId } = bracketConfig[type];
  const dataset = datasetFor(datasetType);
  const brackets = planCurrent[bracketsField];
  let cumulative = 0;
  const bracketResults = [];
  for (let i = 0; i < brackets.length; i++) {
    // Find bottom of this bracket.
    let from = (i == 0) ? floor : brackets[i - 1].top;
    // Ignore entries under this bracket and sum taxable amount otherwise.
    const { count, take } = dataset.filter(e => (e.from >= from)).reduce((a, b) => {
      a.count += b.count;
      a.take += b.count * ((brackets[i].percent / 100) * (Math.min(b.avg, brackets[i].top) - from));
      return a;
    }, { count: 0, take: 0 })
    cumulative += take;
    bracketResults.push({ count, take })
  }
  data[type].brackets = bracketResults;
  data.totals[type] = cumulative;
  drawBracketChart(type);
  drawBracketTable(type);
  drawAssumptions(assumptionsId, datasetType);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Draws evenly-spaced tick marks under a slider, spaced every tickStep
// between min and max.
function renderSliderTicks(tickContainerSelection, min, max, tickStep) {
  const ticks = [];
  for (let t = min; t <= max + 1e-6; t += tickStep) {
    ticks.push(Math.round(t * 100) / 100);
  }
  const marks = tickContainerSelection.selectAll("span").data(ticks);
  marks.exit().remove();
  marks.enter().append("span").merge(marks).attr("title", (d) => d);
}

// Applies a slider's min/max/step/value, its tick marks, and its live-value
// output text - the shared setup flat-rate and multi-component sliders both
// need. `range.unit` is absent for flat-rate sliders (always "%", one
// decimal place); multi-component sliders always carry a unit (two decimal
// places, with a space before non-% units).
function applySliderRange(sliderSel, ticksSel, outputSel, range, value) {
  const { min, max, step, tickStep, unit } = range;
  sliderSel.attr("min", min).attr("max", max).attr("step", step);
  sliderSel.property("value", value);
  renderSliderTicks(ticksSel, min, max, tickStep);
  const formatted = unit === undefined ? (+value).toFixed(1) : (+value).toFixed(2);
  outputSel.text(unit === undefined || unit === "%" ? `${formatted}%` : `${formatted} ${unit}`);
}

// Flat-rate tax types: a single rate applied against a dataset of named
// values.
const flatRateConfig = {
  gst: {
    datasetType: "gst", containerId: "#gst-table-container", sliderId: "#sliderGst", rateField: "gst", assumptionsId: "#gst-assumptions",
    sliderLabel: "GST rate", min: 0, max: 25, step: 0.1, tickStep: 5,
  },
};

function calculateFlatRateTax(category) {
  const { datasetType, rateField, assumptionsId } = flatRateConfig[category];
  const dataset = datasetFor(datasetType);
  const rate = planCurrent[rateField];

  let cumulativeTake = 0;
  const items = dataset.map(d => {
    const take = d.value * (rate / 100);
    cumulativeTake += take;
    return { name: d.name, total: d.value, take: take };
  });

  data[category] = items;
  data.totals[category] = cumulativeTake;
  drawFlatRateTable(category);
  drawAssumptions(assumptionsId, datasetType);
}

function drawFlatRateTable(category) {
  const { containerId, sliderId, rateField, min, max, step, tickStep } = flatRateConfig[category];
  const range = { min, max, step, tickStep };

  const rowsSelection = d3.select(containerId).select("tbody").selectAll("tr").data(data[category]);

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d) => `
         <td>${d.name}</td>
         <td>${formatBillions(d.total)}</td>
         <td>${planCurrent[rateField]}%</td>
         <td>${formatBillions(d.take)}</td>
      `)

  rowsSelection.exit().remove();

  applySliderRange(d3.select(sliderId), d3.select(`${sliderId}-ticks`), d3.select(`${sliderId}-value`), range, planCurrent[rateField]);
}

function changeFlatRate(category, value) {
  ensureCustomPlan();
  planCurrent[flatRateConfig[category].rateField] = clamp(parseFloat(value), 0, 100);
  calculateFlatRateTax(category);
  drawTotal();
}

const calculateGST = () => calculateFlatRateTax("gst");

// Multi-component tax types: several named/independently-rated
// categories, each with its own dataset "slug".
const multiComponentConfig = {
  corp: {
    datasetType: "corp", containerId: "#corp-table-container", assumptionsId: "#corp-assumptions",
    sliderLabel: "Rate", sliderDefaults: { unit: "%", min: 0, max: 50, step: 0.1, tickStep: 10 },
  },
  land: {
    datasetType: "land", containerId: "#land-table-container", assumptionsId: "#land-assumptions",
    sliderLabel: "Rate", sliderDefaults: { unit: "%", min: 0, max: 5, step: 0.1, tickStep: 1 },
  },
  otherDirect: {
    datasetType: "otherDirect", containerId: "#otherdirect-table-container", assumptionsId: "#otherdirect-assumptions",
    sliderLabel: "Rate", sliderDefaults: { unit: "%", min: 0, max: 50, step: 0.1, tickStep: 10 },
    sliderOverrides: { fbt: { max: 100, tickStep: 20 } },
  },
  otherIndirect: {
    datasetType: "otherIndirect", containerId: "#otherindirect-table-container", assumptionsId: "#otherindirect-assumptions",
    sliderLabel: "Rate", sliderDefaults: { unit: "%", min: 0, max: 100, step: 1, tickStep: 20 },
    sliderOverrides: {
      tobaccoExcise: { label: "Excise rate", unit: "$/1,000 cigarettes", min: 0, max: 3000, step: 10, tickStep: 500 },
      alcoholExcise: { label: "Excise rate", unit: "$/L pure alcohol", min: 0, max: 100, step: 0.5, tickStep: 20 },
      roadUserCharges: { label: "RUC rate", unit: "$/1,000km", min: 0, max: 200, step: 1, tickStep: 25 },
      gamingDuty: { label: "Duty rate", unit: "%", min: 0, max: 50, step: 0.1, tickStep: 10 },
      fuelExcise: { label: "Excise rate", unit: "¢/L", min: 0, max: 150, step: 0.5, tickStep: 25 },
      ets: { label: "Carbon price", unit: "$/tonne CO2-e", min: 0, max: 250, step: 1, tickStep: 50 },
      wasteLevy: { label: "Levy rate", unit: "$/tonne", min: 0, max: 300, step: 5, tickStep: 50 },
      nitrateTax: { label: "Charge rate", unit: "$/kg N", min: 0, max: 10, step: 0.1, tickStep: 2 },
    },
    // Lets a slug's taxable base be adjusted before tax is applied, rather
    // than just its rate - used by the "Exempt light EVs" checkbox to
    // subtract EV_RUC_KM_ESTIMATE from the RUC base without a special case
    // in calculateMultiComponentTax itself.
    baseAdjustments: {
      roadUserCharges: (value) => planCurrent.evRucExempt ? Math.max(0, value - (metaFor("otherIndirect").evRucExemptDistanceKm ?? 0)) : value,
    },
    // Per-slug checkbox controls, rendered under that slug's own header by
    // drawMultiComponentTable rather than bolted onto the tab generically -
    // any future modifier belongs here, filed under the slug it affects.
    modifiers: {
      roadUserCharges: [{
        id: "ev-ruc-exempt",
        label: "Exempt light EVs (pre-1 Apr 2024 policy - EVs currently pay RUC like other vehicles)",
        get: () => planCurrent.evRucExempt,
        set: (checked) => changeEvRucExemption(checked),
      }],
    },
  },
  nonTaxRevenue: {
    datasetType: "nonTaxRevenue", containerId: "#nontaxrevenue-table-container", assumptionsId: "#nontaxrevenue-assumptions",
    sliderLabel: "Rate", sliderDefaults: { unit: "%", min: 0, max: 100, step: 1, tickStep: 20 },
    sliderOverrides: {
      earnerLevy: { label: "Levy rate", unit: "%", min: 0, max: 5, step: 0.01, tickStep: 1 },
      workLevy: { label: "Levy rate", unit: "%", min: 0, max: 5, step: 0.01, tickStep: 1 },
      mvLevy: { label: "Levy rate", unit: "$/vehicle", min: 0, max: 300, step: 1, tickStep: 50 },
    },
  },
};

function sliderRangeFor(category, slug) {
  const cfg = multiComponentConfig[category];
  return { label: cfg.sliderLabel, ...cfg.sliderDefaults, ...(cfg.sliderOverrides?.[slug] ?? {}) };
}

function formatBillions(value) {
  return `$${(value / 1000000).toFixed(2)}B`;
}

// Converts a dataset component's stored value to its plain base unit
// (litres, km, tonnes, cigarettes, vehicles) before auto-scaling to K/M/B
// for display - keyed on the "unit" field set on each component in
// data/<year>/*.json, not on slug, so a new dataset only needs to pick one
// of these (or add a new one) rather than writing its own formatter.
const UNIT_SCALE = {
  "kL": { multiplier: 1000, base: "L" },
  "kt": { multiplier: 1000, base: "t" },
  "kt CO2-e": { multiplier: 1000, base: "t CO2-e" },
  "t N": { multiplier: 1, base: "t N" },
  "million cigarettes": { multiplier: 1000000, base: "cigarettes" },
  "million km": { multiplier: 1000000, base: "km" },
  "thousand vehicles": { multiplier: 1000, base: "vehicles" },
};

// $K components (the large majority - corp, land, otherDirect, and most of
// nonTaxRevenue) fall back to the same $B formatting used everywhere else in
// the app, rather than a UNIT_SCALE entry, since formatBillions already does
// exactly this conversion.
function formatTaxable(unit, value) {
  const scale = UNIT_SCALE[unit];
  if (!scale) return formatBillions(value);
  const raw = value * scale.multiplier;
  const abs = Math.abs(raw);
  if (abs >= 1000000000) return `${(raw / 1000000000).toFixed(2)}B ${scale.base}`;
  if (abs >= 1000000) return `${(raw / 1000000).toFixed(2)}M ${scale.base}`;
  if (abs >= 1000) return `${(raw / 1000).toFixed(2)}K ${scale.base}`;
  return `${raw.toFixed(2)} ${scale.base}`;
}

function calculateMultiComponentTax(category) {
  const { datasetType, assumptionsId, baseAdjustments } = multiComponentConfig[category];
  const dataset = datasetFor(datasetType);
  const rates = planCurrent[category];

  let cumulativeTake = 0;
  const result = dataset.map(entry => {
    // A slug with no entry in planCurrent[category] has no policy rate at
    // all (e.g. non-tax revenue) - treated as a fixed 100% pass-through.
    const rate = rates[entry.slug] ?? 100;
    // Most rates are a % (divide by 100); a few (cents/litre, $/tonne, etc.)
    // are real per-unit rates with their own divisor - see the dataset
    // entry's own rateDivisor.
    const divisor = entry.rateDivisor ?? 100;
    const adjustBase = baseAdjustments?.[entry.slug];
    let components = [];
    entry.components.forEach(x => {
      const total = adjustBase ? adjustBase(x.value) : x.value;
      let take = total * rate / divisor;
      components.push({ name: x.name, total: total, take: take, slug: entry.slug, unit: x.unit });
      cumulativeTake += take;
    });
    return { name: entry.name, description: entry.description, components: components, slug: entry.slug };
  });

  data[category] = result;
  data.totals[category] = cumulativeTake;
  drawMultiComponentTable(category);
  drawAssumptions(assumptionsId, datasetType);
}

function drawMultiComponentTable(category) {
  const { containerId } = multiComponentConfig[category];
  const rates = planCurrent[category];

  // Group-level (one per dataset category, e.g. one per corp/otherIndirect
  // slug) update/enter/exit, keyed by slug so groups persist across redraws.
  const containersUpdate = d3.select(containerId)
    .selectAll(".multi-component-group")
    .data(data[category], d => d.slug);

  containersUpdate.exit().remove();

  const containersEnter = containersUpdate.enter()
    .append("div")
    .attr("class", "multi-component-group")
    .attr("id", (d) => `${containerId.slice(1)}-${d.slug}`)

  containersEnter
    .append("h4")
    .text((d) => d.name);

  // Per-slug modifier checkboxes (e.g. "Exempt light EVs" under Road User
  // Charges) - rendered once per group here; checked state is synced below
  // in containersMerged on every redraw, same as the rate slider.
  const { modifiers } = multiComponentConfig[category];
  containersEnter.each(function (d) {
    const mods = modifiers?.[d.slug];
    if (!mods) return;
    mods.forEach((mod) => {
      d3.select(this)
        .append("label")
        .attr("class", "modifier-label")
        .html(`<input type="checkbox" id="modifier-${category}-${d.slug}-${mod.id}"> ${mod.label}`)
        .select("input")
        .on("change", function () { mod.set(this.checked); });
    });
  });

  // Slugs with no entry in planCurrent[category] have no policy rate at all
  // (e.g. non-tax revenue) - only rated slugs get a slider.
  const slideContainerEnter = containersEnter
    .filter((d) => rates[d.slug] !== undefined)
    .append("div")
    .attr("class", "slidecontainer");

  slideContainerEnter
    .append("label")
    .attr("class", "slider-label")
    .attr("for", (d) => `slider-${category}-${d.slug}`)
    .html((d) => `<span>${sliderRangeFor(category, d.slug).label}</span><output id="slider-${category}-${d.slug}-value"></output>`);

  slideContainerEnter
    .append("input")
    .attr("type", "range")
    .attr("class", "slider")
    .attr("id", (d) => `slider-${category}-${d.slug}`)
    .attr("oninput", (d) => `changeMultiComponentRate('${category}', '${d.slug}', this.value)`)

  slideContainerEnter
    .append("div")
    .attr("class", "tick-marks")
    .attr("id", (d) => `slider-${category}-${d.slug}-ticks`);

  const tablesEnter = containersEnter
    .append("table")
    .attr("id", (d) => `${category}-table-${d.slug}`)
    .attr("aria-label", (d) => d.name)

  tablesEnter
    .append("tr").attr("class", "mdc-data-table__header-row")
    .html(`<th role="columnheader" scope="col"></th>
      <th role="columnheader" scope="col">Taxable</th>
      <th class="mdc-data-table__header-cell" role="columnheader" scope="col">Amount</th>
    `)

  tablesEnter.append("tbody");

  // Every group (new or already on the page) gets its slider position and
  // row data refreshed - this is the part the original corp-only version of
  // this function was missing, which meant numbers never updated after the
  // first render.
  const containersMerged = containersEnter.merge(containersUpdate);

  containersMerged.select(".slider")
    .each(function (d) {
      const sliderId = this.id;
      applySliderRange(
        d3.select(this), d3.select(`#${sliderId}-ticks`), d3.select(`#${sliderId}-value`),
        sliderRangeFor(category, d.slug), rates[d.slug]);
    });

  containersMerged.each(function (d) {
    (modifiers?.[d.slug] ?? []).forEach((mod) => {
      d3.select(`#modifier-${category}-${d.slug}-${mod.id}`).property("checked", mod.get());
    });
  });

  const tablerowsUpdate = containersMerged.select("tbody").selectAll("tr").data((d) => d.components);

  tablerowsUpdate.exit().remove();

  tablerowsUpdate
    .enter()
    .append("tr")
    .merge(tablerowsUpdate)
    .html((d) => `
      <td>${d.name}</td>
      <td>${formatTaxable(d.unit, d.total)}</td>
      <td>${formatBillions(d.take)}</td>
    `)
}

function changeMultiComponentRate(category, tid, value) {
  ensureCustomPlan();
  const { min, max } = sliderRangeFor(category, tid);
  planCurrent[category][tid] = clamp(parseFloat(value), min, max);
  calculateMultiComponentTax(category);
  drawTotal();
}

const calculateCorp = () => calculateMultiComponentTax("corp");
const calculateLand = () => calculateMultiComponentTax("land");
const calculateOtherDirect = () => calculateMultiComponentTax("otherDirect");
const calculateOtherIndirect = () => calculateMultiComponentTax("otherIndirect");
const calculateNonTaxRevenue = () => calculateMultiComponentTax("nonTaxRevenue");

function changeEvRucExemption(checked) {
  ensureCustomPlan();
  planCurrent.evRucExempt = checked;
  calculateOtherIndirect();
  drawTotal();
}

// Clones every field the three tax-shape configs know about (rather than a
// hand-maintained field list) so adding a new tax type to bracketConfig/
// flatRateConfig/multiComponentConfig is enough on its own - no separate
// edit needed here to keep a custom plan's clone complete. evRucExempt is a
// lone boolean outside that pattern, so it's cloned explicitly.
function createNewIncomePlan() {
  const clone = { name: "Custom Plan", isCustom: true, evRucExempt: planCurrent.evRucExempt };
  Object.values(bracketConfig).forEach(({ bracketsField }) => {
    clone[bracketsField] = structuredClone(planCurrent[bracketsField]);
  });
  Object.values(flatRateConfig).forEach(({ rateField }) => {
    clone[rateField] = planCurrent[rateField];
  });
  Object.keys(multiComponentConfig).forEach((category) => {
    clone[category] = structuredClone(planCurrent[category]);
  });
  plans.push(clone);
  planCurrent = plans[plans.length - 1];
  drawDropdown();
}

// Predefined plans are read-only; the first edit to one clones it into a new
// "Custom Plan" (via createNewIncomePlan) and repoints planCurrent at the
// clone, so every mutator below can call this instead of re-checking
// `planCurrent.isCustom` itself.
function ensureCustomPlan() {
  if (!planCurrent.isCustom) { createNewIncomePlan(); }
}

function insertBracket(type) {
  ensureCustomPlan();
  const { bracketsField, xDomain } = bracketConfig[type];
  const brackets = planCurrent[bracketsField];

  // If only one bracket, just add a new one at half way.
  if (brackets.length === 1) {
    brackets[0].top = (xDomain[1] / 2);
  } else {
    // Get range of second to last bracket.
    const bracketEnd = brackets[brackets.length - 2].top;
    brackets[brackets.length - 1].top = bracketEnd + ((xDomain[1] - bracketEnd) / 2);
  }
  brackets.push({ id: 0, top: 999999999, percent: brackets[brackets.length - 1].percent + 5 })
  brackets.forEach((v, i) => { v.id = i }); // re-index
  calculateBracketTax(type);
  drawTotal();
}
function removeBracket(type, i) {
  ensureCustomPlan();
  const brackets = planCurrent[bracketConfig[type].bracketsField];
  brackets.splice(i, 1);
  brackets.forEach((v, i) => { v.id = i }); // re-index
  brackets[brackets.length - 1].top = 999999999;
  calculateBracketTax(type);
  drawTotal();
}
function changeBracketPercent(type, bracket, value) {
  // Called when a bracket's percentage is changed.
  ensureCustomPlan();
  const brackets = planCurrent[bracketConfig[type].bracketsField];
  brackets[bracket].percent = clamp(parseFloat(value), 0, 100);
  // TODO: allow negative tax range.
  calculateBracketTax(type);
  drawTotal();
}
function changeBracketRange(type, bracket, value) {
  // Called when a bracket's range is changed.
  ensureCustomPlan();
  const { bracketsField, floor } = bracketConfig[type];
  const brackets = planCurrent[bracketsField];
  brackets[bracket].top = Math.max(parseFloat(value), (bracket < 1) ? floor : brackets[bracket - 1].top + 1);
  calculateBracketTax(type);
  drawTotal();
}

function changeGSTRate(value) {
  changeFlatRate("gst", value);
}

function drawBracketTable(type) {
  // Create a table to display rectangle dimensions
  const { bracketsField, tableContainerId, addButtonId, maxBrackets, floor, unitLabel } = bracketConfig[type];
  const brackets = planCurrent[bracketsField];
  const container = d3.select(tableContainerId);

  // Update rows in tbody
  const rowsSelection = container.select("tbody").selectAll("tr").data(brackets)

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d, i) => `
     <td>${letters[i]}</td>
     <td>$${(i < 1 ? floor : brackets[i - 1].top).toFixed(2)}${unitLabel}</td>
     <td>${i == brackets.length - 1 ? "--" : `
      $ <input
      class="income-bracket-range"
      type="text"
      inputmode="decimal"
      value=${d.top.toFixed(2)}
      onchange="changeBracketRange('${type}', ${i}, this.value)"> ${unitLabel}</td>`
    }
     <td><input class="income-bracket-percent" type="text" inputmode="decimal" value=${d.percent.toFixed()} onchange="changeBracketPercent('${type}', ${i}, this.value)"> %</td>
     <td>${data[type].brackets[i].count}</td>
     <td>${formatBillions(data[type].brackets[i].take)}</td>
     <td>${i > 0 ? `<button onclick="removeBracket('${type}', ${i})">x</button>` : ""}</td>
  `)
  const addButton = d3.select(addButtonId);
  if (brackets.length > maxBrackets) {
    addButton.attr('disabled', true);
    addButton.attr('title', 'Thats enough..')
  } else {
    addButton.attr('disabled', null);
    addButton.attr('title', 'Add a new bracket.')
  }
  // Remove old rows
  rowsSelection.exit().remove();
}

function switchTab(id) {
  d3.selectAll(".button__tab")
    .classed("active", false);
  const a = d3.selectAll(".tab");
  a.style("display", "none");

  d3.select(id + "-button")
    .classed("active", true);
  const x = d3.select(id);
  x.style("display", null);
}

// This stacks every category in data.totals, tax and non-tax alike (ACC
// levies, nonTaxRevenue) - by design, all Crown revenue counts here even
// though not all of it is technically "tax". See TODO.md.
function drawTotal() {

  let cumulative = 0;

  const stackedData = Object.entries(data.totals).map((k) => ({
    name: k[0],
    value: k[1],
    start: cumulative,
    end: (cumulative += k[1]),
  }));

  totalXScale.domain(["Total"]);
  totalYScale.domain([0, 200000000]);
  colorScale.domain(Object.keys(data.totals));

  const bars = totalPlot.selectAll("rect")
    .data(stackedData, d => d.name);

  const labels = totalPlot.selectAll("text.label")
    .data(stackedData, d => d.name);

  bars.join("rect")
    .attr("x", totalXScale("Total"))
    .attr("y", d => totalYScale(d.end))
    .attr("height", d => totalYScale(d.start) - totalYScale(d.end))
    .attr("width", totalXScale.bandwidth())
    .attr("fill", d => colorScale(d.name));


  labels.join("text")
    .attr("class", "label")
    .attr("x", totalXScale("Total"))
    .attr("y", d => totalYScale(d.end))
    .attr("dx", totalXScale.bandwidth() / 2)
    .attr("dy", "1em")
    .attr("text-anchor", "middle")
    .text(d => (d.value < 7000000) ? "" : d.name + "\n" + (d.value / 1000000).toFixed(2) + "B")

  totalPlot.selectAll(".y-axis").remove();
}

// Joins `brackets` against `className` rects within `layer`. `setupEnter`
// sets static attrs/styles that don't change across redraws (only run once,
// on newly-entered nodes); `dynamicAttrs` is an {attr: fn} map applied to
// both new and existing nodes every call.
function joinLayerRects(layer, className, brackets, setupEnter, dynamicAttrs, dragBehavior) {
  const sel = layer.selectAll(`.${className}`).data(brackets);
  sel.exit().remove();
  const entered = sel.enter().append("rect").attr("class", className);
  setupEnter(entered);
  const merged = entered.merge(sel);
  Object.entries(dynamicAttrs).forEach(([attr, fn]) => merged.attr(attr, fn));
  if (dragBehavior) merged.call(dragBehavior);
  return merged;
}

function drawBracketChart(type) {
  const { bracketsField, floor } = bracketConfig[type];
  const { xScale, yScaleRate, rectLayer, topHandleLayer, rightHandleLayer, dragUp, dragRight } = bracketPlots[type];
  const brackets = planCurrent[bracketsField];

  // Left edge of bracket i, and its rendered width (the last bracket
  // overflows well past the visible chart edge - the SVG clips it, giving
  // the "unbounded top bracket" look income tax has).
  const rectFrom = (i) => (i < 1) ? floor : brackets[i - 1].top;
  const rectWidth = (d, i) => {
    const from = rectFrom(i);
    return i == brackets.length - 1
      ? Math.max(0, width - xScale(from)) + 50
      : xScale(d.top) - xScale(from);
  };
  // Pixel y of the taller of bracket i and its neighbour, computed once per
  // bracket rather than per attribute, for sizing a shared-boundary handle
  // that stays draggable even when one side is 0%.
  const yScaleRateZero = yScaleRate(0);
  const boundaryY = brackets.map((b, i) => yScaleRate(Math.max(b.percent, brackets[i + 1]?.percent ?? b.percent)));

  joinLayerRects(rectLayer, "bracket-rect", brackets,
    (entered) => entered.attr("fill", "none").attr("stroke", "black").attr("stroke-width", 1),
    {
      x: (d, i) => xScale(rectFrom(i)),
      y: d => yScaleRate(d.percent),
      width: rectWidth,
      height: d => yScaleRateZero - yScaleRate(d.percent),
    });

  joinLayerRects(topHandleLayer, "handle-top", brackets,
    (entered) => entered.attr("fill", "transparent").style("cursor", "row-resize"),
    {
      x: (d, i) => xScale(rectFrom(i)),
      width: rectWidth,
      y: d => yScaleRate(d.percent) - (handleWidth / 2),
      height: handleWidth,
    },
    dragUp);

  joinLayerRects(rightHandleLayer, "handle-right", brackets,
    (entered) => entered.attr("fill", "transparent").style("cursor", "col-resize"),
    {
      x: d => xScale(d.top) - (handleWidth / 2),
      width: (d, i) => ((i < brackets.length - 1) ? handleWidth : 0),
      y: (d, i) => boundaryY[i],
      height: (d, i) => yScaleRateZero - boundaryY[i],
    },
    dragRight);
}

function recalculateAll() {
  calculateBracketTax("income");
  calculateGST();
  calculateCorp();
  calculateLand();
  calculateBracketTax("wealth");
  calculateOtherDirect();
  calculateOtherIndirect();
  calculateNonTaxRevenue();
  data.totals.other = metaFor("otherIndirect").otherIndirectResidual ?? 0;
  drawTotal();
}

drawDropdown();
drawYearDropdown();
drawBracketHistogram("income");
drawBracketHistogram("wealth");
recalculateAll();

// allow access from page
window.changeBracketRange = changeBracketRange;
window.changeBracketPercent = changeBracketPercent;
window.removeBracket = removeBracket;
window.insertBracket = insertBracket;
window.changeGSTRate = changeGSTRate;
window.changeFlatRate = changeFlatRate;
window.changeMultiComponentRate = changeMultiComponentRate;
window.switchTab = switchTab;
