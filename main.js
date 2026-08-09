
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
  general: {
    2024: await loadDataset("./data/2024/general.json"),
    2025: await loadDataset("./data/2025/general.json"),
  },
  expenditure: {
    2024: await loadDataset("./data/2024/expenditure.json"),
    2025: await loadDataset("./data/2025/expenditure.json"),
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

// People tab: illustrative example people (not year-scoped, since a
// person's own financial facts don't depend on the FY data vintage) - see
// data/people.json's top-level "note" for why these figures aren't sourced
// the way every other dataset in data/ is.
const people = (await d3.json("./data/people.json")).people;
people.forEach(p => { p.isCustom = false; });
let personCurrent = people[1];

let data = {
  totals: {
    income: 0, gst: 0, corp: 0, other: metaFor("otherIndirect").otherIndirectResidual ?? 0,
    wealth: 0, land: 0, otherDirect: 0, otherIndirect: 0,
    nonTaxRevenue: 0
  },
  // Mirrors `totals` - government spending rather than revenue. Not netted
  // against `totals` yet - see TODO.md. UBI aside, the rest of this object's
  // keys are populated dynamically by calculateMultiComponentTax("govtSpending")
  // - one key per functional spending category (Health, Education, etc.),
  // not one lump sum - see multiComponentConfig.govtSpending's perCategoryTotals.
  expenditures: {
    UBI: 0
  },
  income: { brackets: [] },
  gst: [],
  corp: [],
  wealth: { brackets: [] },
  land: [],
  otherDirect: [],
  otherIndirect: [],
  nonTaxRevenue: [],
  govtSpending: []
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
function createBracketPlot(type, containerId, xDomain, rateDomain = [0, 100], unitLabel = "") {
  const plot = d3
    .select(containerId)
    .append("svg")
    .attr("width", width + margin * 2)
    .attr("height", height + margin * 2)
    .append("g")
    .attr("transform", `translate(${margin}, ${margin})`);

  const xScale = d3.scaleLinear().domain(xDomain).range([0, width]);
  const yScaleRate = d3.scaleLinear().domain(rateDomain).range([height, 0]);
  const yScaleCount = d3.scaleLinear().domain([0, 1]).range([height, 0]);

  plot.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale));
  plot.append("g").attr("class", "y-axis").call(d3.axisLeft(yScaleRate));
  const yAxisCount = plot.append("g").attr("class", "y-axis").attr("transform", `translate(${width},0)`).call(d3.axisRight(yScaleCount));

  // Reference line at 0% so a negative-rate bracket (if a type's rateDomain
  // ever dips below 0 again) reads as "below the line" rather than looking
  // like a rendering glitch. Skipped when the rate axis bottoms out at 0%
  // (every type today), since it would just coincide with the x-axis.
  if (rateDomain[0] < 0) {
    plot.append("line")
      .attr("class", "zero-rate-line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", yScaleRate(0)).attr("y2", yScaleRate(0))
      .attr("stroke", "#999").attr("stroke-dasharray", "4,3");
  }

  // Axis titles - unitLabel-driven so income/wealth both get real units
  // instead of bare tick numbers.
  plot.append("text")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .attr("x", width / 2).attr("y", height + margin - 10)
    .text(`Income ($${unitLabel})`);
  plot.append("text")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .attr("transform", `translate(${-margin + 15}, ${height / 2}) rotate(-90)`)
    .text("Tax rate (%)");
  plot.append("text")
    .attr("class", "axis-title")
    .attr("text-anchor", "middle")
    .attr("transform", `translate(${width + margin - 10}, ${height / 2}) rotate(90)`)
    .text(`People per $${unitLabel}`);

  const dataContainer = plot.append("g").attr("class", "bracket-data-container");

  // The last bracket's rect/handle deliberately overflow past `width` (see
  // rectWidth in drawBracketChart) for the "unbounded top bracket" look -
  // clipped here to the plot's own bounds so that overflow stops at the
  // chart edge instead of bleeding into the margin where the right-hand
  // "People per $K" axis and title live.
  const clipId = `bracket-clip-${type}`;
  plot.append("clipPath").attr("id", clipId)
    .append("rect").attr("x", 0).attr("y", 0).attr("width", width).attr("height", height);

  // Three persistent layers, appended once in this fixed order, so a newly
  // entered bracket's handle always paints above every bracket's rect -
  // rather than wherever it happens to land in append order. drawBracketChart
  // draws within these layers instead of nesting each bracket's rect/handles
  // in their own <g>, which let a later bracket's rect visually and
  // hit-test-wise cover an earlier bracket's shared-boundary handle.
  const rectLayer = plot.append("g").attr("class", "bracket-rect-layer").attr("clip-path", `url(#${clipId})`);
  const topHandleLayer = plot.append("g").attr("class", "bracket-tophandle-layer").attr("clip-path", `url(#${clipId})`);
  const rightHandleLayer = plot.append("g").attr("class", "bracket-righthandle-layer").attr("clip-path", `url(#${clipId})`);
  const ubiLineLayer = plot.append("g").attr("class", "ubi-line-layer");

  // Created once per plot rather than on every drawBracketChart call - the
  // closures only capture `type`, which is fixed for this plot's lifetime.
  const dragUp = d3.drag().on("drag", function (event, d) {
    changeBracketPercent(type, d.id, yScaleRate.invert(event.y));
  });
  const dragRight = d3.drag().on("drag", function (event, d) {
    changeBracketRange(type, d.id, xScale.invert(event.x));
  });
  const dragUbi = d3.drag().on("drag", function (event) {
    changeUbi(type, xScale.invert(event.x));
  });

  return {
    plot, xScale, yScaleRate, yScaleCount, yAxisCount, dataContainer,
    rectLayer, topHandleLayer, rightHandleLayer, ubiLineLayer, dragUp, dragRight, dragUbi,
  };
}

// floor: implied bottom of bracket 0 (0 for income; wealth data includes
// negative net worth, so its ladder starts below zero). Tax rate is always
// shown/editable as 0-100% (createBracketPlot's rateDomain/changeBracketPercent's
// minPercent default) - no bracket type currently allows negative rates.
// ubiField marks which types have a UBI line/plan field (income only).
const bracketConfig = {
  income: {
    datasetType: "income", bracketsField: "brackets", plotContainerId: "#plot-container",
    tableContainerId: "#income-bracket-table-container", addButtonId: "#income-bracket-add",
    assumptionsId: "#income-assumptions", xDomain: [0, 300], floor: 0, maxBrackets: 11, unitLabel: "K",
    ubiField: "ubi",
  },
  wealth: {
    datasetType: "wealth", bracketsField: "wealthBrackets", plotContainerId: "#wealth-plot-container",
    tableContainerId: "#wealth-bracket-table-container", addButtonId: "#wealth-bracket-add",
    assumptionsId: "#wealth-assumptions", xDomain: [-500, 12000], floor: -500, maxBrackets: 8, unitLabel: "K",
  },
};

const bracketPlots = {};
Object.entries(bracketConfig).forEach(([type, cfg]) => {
  bracketPlots[type] = createBracketPlot(type, cfg.plotContainerId, cfg.xDomain, cfg.rateDomain, cfg.unitLabel);
});

// Shifts every band's from/to/avg up by this type's UBI amount (income
// only) - models "everyone's income rises by the UBI amount" for both the
// tax calc and the background histogram, so the two stay visually
// consistent as the UBI line is dragged.
function shiftedDatasetFor(type) {
  const { datasetType, ubiField } = bracketConfig[type];
  const raw = datasetFor(datasetType);
  const shift = ubiField ? (planCurrent[ubiField] ?? 0) : 0;
  return shift ? raw.map(b => ({ ...b, from: b.from + shift, to: b.to + shift, avg: b.avg + shift })) : raw;
}

function drawBracketHistogram(type) {
  // Redraw the background distribution bars for the current year.
  const { xScale, yScaleRate, yScaleCount, yAxisCount, dataContainer } = bracketPlots[type];
  const dataset = shiftedDatasetFor(type);
  // Anchor the histogram's baseline to the 0% tax-rate line, not the bottom
  // of the whole chart - income's rate axis now extends below zero, and the
  // population histogram should still start at zero rather than bleeding
  // into negative-rate territory. (No-op for wealth, whose rate axis already
  // bottoms out at 0%, so zeroY === height there.)
  const zeroY = yScaleRate(0);
  yScaleCount.range([zeroY, 0]);
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
    .attr("height", d => zeroY - yScaleCount(d.count / (d.to - d.from)))
    .attr("fill", "lightblue");

  dataSelection.exit().remove();
}

// Shared setup for every single-column stacked-bar chart (government revenue
// Total, government Expenditure, and - reused below - a selected person's
// Income/Expenditure bars). `label` is the one fixed x-axis category every
// bar in the plot stacks onto.
function createStackedBarPlot(containerId, label) {
  const plot = d3.select(containerId)
    .append("svg")
    .attr("width", 200)
    .attr("height", 1000);

  const xScale = d3.scaleBand()
    .domain([label])
    .range([0, 180])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .range([900, 0]);

  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
  plot.append("g").attr("class", "y-axis").attr("transform", `translate(170,0)`).call(d3.axisRight(yScale));

  return { plot, xScale, yScale, colorScale, label };
}

// Single tooltip element shared by every stacked-bar plot (Total,
// Expenditure, and both People bars) - cheaper than one per plot, and only
// one can ever be visible at a time since hover is exclusive.
const chartTooltip = d3.select("body")
  .append("div")
  .attr("class", "chart-tooltip");

// Redraws a stacked-bar chart created by createStackedBarPlot from a flat
// {itemName: value} object - each key becomes one stacked segment, in
// object-key order. `domainMax` fixes the y-axis scale (government bars use
// a stable value so they don't jitter); omit it to size the axis to this
// draw's own total instead (needed for person bars, which vary hugely
// between archetypes). `formatValue` formats a segment's value for its
// tooltip. `categoryOf` maps an item name to the sub-tab/category it belongs
// to (defaults to the item itself, i.e. no finer grouping than one segment
// per category) - segments sharing a category are colour-shades of the same
// hue rather than unrelated colours, and `categoryLabel` supplies that
// category's display name for the tooltip. On-bar text labels used to do
// this job but collided/vanished below a size threshold on the denser bars
// (govtSpending, person expenditure) - a hover tooltip has no such limit.
function drawStackedBar(refs, dataObj, { domainMax, formatValue, categoryOf = (name) => name, categoryLabel = (key) => key } = {}) {
  const { plot, xScale, yScale, colorScale, label } = refs;

  let cumulative = 0;
  const stackedData = Object.entries(dataObj).map(([name, value]) => ({
    name, value, category: categoryOf(name),
    start: cumulative,
    end: (cumulative += value),
  }));

  yScale.domain([0, domainMax ?? cumulative]);

  const categories = [...new Set(stackedData.map(d => d.category))];
  colorScale.domain(categories);

  // Lightness position (0-1) of each item within its category's group of
  // segments - a lone item in a category sits at mid-lightness, multiple
  // items spread evenly across the range, so a category's segments read as a
  // family of shades of the same hue.
  const shadePosition = new Map();
  categories.forEach(cat => {
    const items = stackedData.filter(d => d.category === cat);
    items.forEach((d, i) => shadePosition.set(d.name, items.length > 1 ? i / (items.length - 1) : 0.5));
  });
  const fillFor = (d) => {
    const hsl = d3.hsl(colorScale(d.category));
    hsl.l = 0.35 + shadePosition.get(d.name) * 0.4;
    return hsl.toString();
  };

  const bars = plot.selectAll("rect").data(stackedData, d => d.name);

  bars.join("rect")
    .attr("x", xScale(label))
    .attr("y", d => yScale(d.end))
    .attr("height", d => yScale(d.start) - yScale(d.end))
    .attr("width", xScale.bandwidth())
    .attr("fill", fillFor)
    .on("mouseenter", (event, d) => {
      chartTooltip
        .html(`<strong>${categoryLabel(d.category)}</strong><br>${d.name}: ${formatValue(d.value)}`)
        .classed("visible", true);
    })
    .on("mousemove", (event) => {
      chartTooltip.style("left", `${event.pageX + 12}px`).style("top", `${event.pageY + 12}px`);
    })
    .on("mouseleave", () => chartTooltip.classed("visible", false));

  plot.selectAll(".y-axis").remove();
}

const totalBar = createStackedBarPlot("#total-container", "Total");
const expenditureBar = createStackedBarPlot("#expenditure-container", "Expenditure");
const personIncomeBar = createStackedBarPlot("#person-income-container", "Income");
const personExpenditureBar = createStackedBarPlot("#person-expenditure-container", "Expenditure");

// Shared setup for a "pick one item from a named list, by index" dropdown -
// used for both the Tax Plan and People selectors, which differ only in
// which list/current-item they bind to and what happens on selection.
// Returns the redraw function (call it whenever the list or current item
// changes, e.g. after adding a custom entry). Not used for the year
// dropdown below - that selects by value/content, not list index, a
// genuinely different shape.
function createIndexedDropdown(containerId, id, list, getCurrent, onSelect) {
  const select = d3.select(containerId)
    .append("select")
    .attr("id", id)
    .on("change", function () { onSelect(list[this.value]); });

  return function drawIndexedDropdown() {
    const options = select.selectAll("option").data(list);

    options
      .enter()
      .append("option")
      .merge(options) // Merge enter and update selections
      .text(d => d.name) // Set display text
      .attr("value", (d, i) => i); // Set value

    select.node().selectedIndex = list.indexOf(getCurrent());
    options.exit().remove();
  };
}

// Draw plan dropdown
const dropdownContainer = d3.select("#dropdown-container");
const drawDropdown = createIndexedDropdown("#dropdown-container", "dropdown-menu", plans, () => planCurrent, (plan) => {
  planCurrent = plan;
  recalculateAll();
});

// Draw dataset-year dropdown
dropdownContainer.append("h2").text("Data year:");
const yearDropdown = dropdownContainer
  .append("select")
  .attr("id", "year-dropdown")
  .on("change", function () {
    currentYear = parseInt(this.value, 10);
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
  const dataset = shiftedDatasetFor(type);
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
  drawBracketHistogram(type);
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
  // Government spending, not revenue - writes into data.expenditures (via
  // totalsBucket/totalsKey) instead of data.totals, so it stacks separately
  // from tax take on the drawer's Total tab rather than getting summed in.
  govtSpending: {
    datasetType: "expenditure",
    // Rendered as three sub-tabs rather than one flat list - each dataset
    // entry's own "group" field (see data/<year>/expenditure.json) picks
    // which container/assumptions box it's drawn into, mirroring the
    // Tax/Income tabs' one-intro-plus-assumptions-per-tab layout.
    groupContainerIds: {
      core: "#govtspending-core-table-container",
      welfare: "#govtspending-welfare-table-container",
      other: "#govtspending-other-table-container",
    },
    groupAssumptionsIds: {
      core: "#govtspending-core-assumptions",
      welfare: "#govtspending-welfare-assumptions",
      other: "#govtspending-other-assumptions",
    },
    totalsBucket: "expenditures", perCategoryTotals: true,
    sliderLabel: "Rate", sliderDefaults: { unit: "$/capita", min: 0, max: 10000, step: 10, tickStep: 2000 },
    sliderOverrides: {
      nzSuper: { label: "Rate", unit: "$/recipient", min: 0, max: 60000, step: 100, tickStep: 10000 },
      jobseeker: { label: "Rate", unit: "$/recipient", min: 0, max: 40000, step: 100, tickStep: 10000 },
      soleParent: { label: "Rate", unit: "$/recipient", min: 0, max: 40000, step: 100, tickStep: 10000 },
      supportedLiving: { label: "Rate", unit: "$/recipient", min: 0, max: 40000, step: 100, tickStep: 10000 },
      gsfPensions: { label: "Rate", unit: "$/capita", min: 0, max: 50, step: 0.1, tickStep: 10 },
      otherExpenses: { label: "Rate", unit: "$/capita", min: 0, max: 100, step: 0.5, tickStep: 20 },
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
  // govtSpending's per-capita/per-recipient slugs store a raw headcount here,
  // not a $K figure - formatBillions would misread it as billions of dollars.
  if (unit === "people") return `${Math.round(value).toLocaleString()} people`;
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
  const { datasetType, assumptionsId, groupAssumptionsIds, baseAdjustments, totalsBucket = "totals", totalsKey = category, perCategoryTotals } = multiComponentConfig[category];
  const dataset = datasetFor(datasetType);
  const rates = planCurrent[category];

  let cumulativeTake = 0;
  const result = dataset.map(entry => {
    // A slug with no entry in planCurrent[category] has no policy rate at
    // all (e.g. non-tax revenue, Finance Costs) - treated as a fixed 100%
    // pass-through.
    const rate = rates[entry.slug] ?? 100;
    // Most rates are a % (divide by 100); a few (cents/litre, $/tonne,
    // $/capita, etc.) are real per-unit rates with their own divisor - see
    // the dataset entry's own rateDivisor.
    const divisor = entry.rateDivisor ?? 100;
    const adjustBase = baseAdjustments?.[entry.slug];
    let components = [];
    let entryTake = 0;
    entry.components.forEach(x => {
      const total = adjustBase ? adjustBase(x.value) : x.value;
      let take = total * rate / divisor;
      components.push({ name: x.name, total: total, take: take, slug: entry.slug, unit: x.unit });
      entryTake += take;
    });
    cumulativeTake += entryTake;
    // govtSpending shows a Revenue-tab-style stacked bar broken down by its
    // own functional categories (Health, Education, ...) rather than one
    // lump sum - every other multi-component category still collapses to
    // one totalsKey number, matching how e.g. otherIndirect's many slugs
    // (fuel excise, tobacco excise, ...) still roll up to one "otherIndirect"
    // total on the Revenue side.
    if (perCategoryTotals) data[totalsBucket][entry.name] = entryTake;
    return { name: entry.name, description: entry.description, components: components, slug: entry.slug, group: entry.group };
  });

  data[category] = result;
  if (!perCategoryTotals) data[totalsBucket][totalsKey] = cumulativeTake;
  drawMultiComponentTable(category);
  // Every sub-tab pulls from the same underlying dataset/sources, so each
  // just gets its own copy of the same assumptions text - same as
  // groupContainerIds above, one draw call per group instead of one shared
  // box, so the layout matches the Tax/Income tabs' per-tab assumptions box.
  if (groupAssumptionsIds) {
    Object.values(groupAssumptionsIds).forEach((id) => drawAssumptions(id, datasetType));
  } else {
    drawAssumptions(assumptionsId, datasetType);
  }
}

// Draws one category's multi-component groups into a single container - the
// whole body of drawMultiComponentTable below, minus the choice of *which*
// container. Split out so govtSpending (rendered as three sub-tabs, one
// container per dataset "group") can call this once per container instead
// of duplicating the corp/land/etc. single-container rendering logic.
function renderMultiComponentGroupsInto(containerId, entries, category) {
  const { modifiers } = multiComponentConfig[category];
  const rates = planCurrent[category];

  // Group-level (one per dataset category, e.g. one per corp/otherIndirect
  // slug) update/enter/exit, keyed by slug so groups persist across redraws.
  const containersUpdate = d3.select(containerId)
    .selectAll(".multi-component-group")
    .data(entries, d => d.slug);

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
    .attr("class", "component-table")
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

function drawMultiComponentTable(category) {
  const { containerId, groupContainerIds } = multiComponentConfig[category];

  if (groupContainerIds) {
    const byGroup = {};
    data[category].forEach((entry) => { (byGroup[entry.group] ??= []).push(entry); });
    Object.entries(groupContainerIds).forEach(([group, cid]) => {
      renderMultiComponentGroupsInto(cid, byGroup[group] ?? [], category);
    });
    return;
  }

  renderMultiComponentGroupsInto(containerId, data[category], category);
}

function changeMultiComponentRate(category, tid, value) {
  ensureCustomPlan();
  const { min, max } = sliderRangeFor(category, tid);
  planCurrent[category][tid] = clamp(parseFloat(value), min, max);
  calculateMultiComponentTax(category);
  drawTotal();
  // govtSpending writes into data.expenditures, not data.totals - drawTotal()
  // alone wouldn't refresh the drawer's Expenditure bar.
  if (multiComponentConfig[category].totalsBucket === "expenditures") drawExpenditure();
}

const calculateCorp = () => calculateMultiComponentTax("corp");
const calculateLand = () => calculateMultiComponentTax("land");
const calculateOtherDirect = () => calculateMultiComponentTax("otherDirect");
const calculateOtherIndirect = () => calculateMultiComponentTax("otherIndirect");
const calculateNonTaxRevenue = () => calculateMultiComponentTax("nonTaxRevenue");
const calculateGovtSpending = () => calculateMultiComponentTax("govtSpending");

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
  const clone = { name: "Custom Plan", isCustom: true, evRucExempt: planCurrent.evRucExempt, ubi: planCurrent.ubi };
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
  brackets[bracket].percent = clamp(parseFloat(value), bracketConfig[type].minPercent ?? 0, 100);
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

function changeUbi(type, value) {
  // Called when the UBI line is dragged or its input is edited.
  ensureCustomPlan();
  const { ubiField, xDomain } = bracketConfig[type];
  planCurrent[ubiField] = clamp(parseFloat(value), 0, xDomain[1]);
  calculateBracketTax(type);
  calculateExpenditure();
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

function switchDrawerTab(id) {
  d3.selectAll(".drawer-tab-button").classed("active", false);
  d3.selectAll(".drawer-tab").style("display", "none");
  d3.select(id + "-button").classed("active", true);
  d3.select(id).style("display", null);
}

// Top-level "Tax/Income" vs "Expenses" nav - same shape as switchDrawerTab,
// just a different pair of classes since .button__tab/.tab are already used
// by the Tax/Income sub-tabs nested inside #top-tab-taxincome.
function switchTopTab(id) {
  d3.selectAll(".top-tab-button").classed("active", false);
  d3.selectAll(".top-tab").style("display", "none");
  d3.select(id + "-button").classed("active", true);
  d3.select(id).style("display", null);
}

// Expenses tab's own sub-tabs (Health & Education / Welfare & Benefits /
// Other Spending) - same shape again, its own classes so switching an
// Expenses sub-tab can't hide/show a Tax/Income sub-tab that happens to
// share an id-less selector.
function switchExpenseTab(id) {
  d3.selectAll(".expense-tab-button").classed("active", false);
  d3.selectAll(".expense-tab").style("display", "none");
  d3.select(id + "-button").classed("active", true);
  d3.select(id).style("display", null);
}

// Display names for the Tax/Income sub-tabs, matching index.html's tab
// headers - used wherever a stacked-bar segment's key is a tax-type slug
// (data.totals' keys, and the person expenditure bar's category mapping
// below) rather than a human-readable name already.
const TAX_CATEGORY_LABELS = {
  income: "Income Tax", gst: "Goods & Services Tax", corp: "Corporate Tax",
  wealth: "Wealth Tax", land: "Land Tax", otherDirect: "Direct Taxes (Other)",
  otherIndirect: "Indirect Tax (Other)", nonTaxRevenue: "Non-Tax Revenue",
};

// Display names for govtSpending's three sub-tab groups (see
// multiComponentConfig.govtSpending's groupContainerIds), matching
// index.html's Expenses sub-tab headers.
const SPENDING_CATEGORY_LABELS = {
  core: "Health & Education", welfare: "Welfare & Benefits", other: "Other Spending",
};

// This stacks every category in data.totals, tax and non-tax alike (ACC
// levies, nonTaxRevenue) - by design, all Crown revenue counts here even
// though not all of it is technically "tax". See TODO.md.
function drawTotal() {
  drawStackedBar(totalBar, data.totals, {
    domainMax: 200000000,
    formatValue: (v) => `${(v / 1000000).toFixed(2)}B`,
    // data.totals' keys are already one-per-category (see the `data`
    // initializer) except "other", the otherIndirect residual - grouped into
    // otherIndirect itself so it shades alongside the tax it's a residual of
    // rather than getting its own unrelated hue.
    categoryOf: (key) => key === "other" ? "otherIndirect" : key,
    categoryLabel: (key) => TAX_CATEGORY_LABELS[key] ?? key,
  });
  // Person tab reads planCurrent's rates, same as every other tab - so it
  // needs to redraw whenever anything tax-relevant changes. Hooking in here
  // (rather than every individual changeX handler) works because drawTotal()
  // already runs after every single mutation in the app - including every
  // tick of a drag gesture, dozens of times/second, so skip the work (two
  // SVG redraws + a table rebuild) while the drawer's People tab isn't even
  // visible. switchDrawerTab() forces one redraw when the tab is opened, to
  // catch up on whatever changed while it was hidden.
  if (personCurrent && d3.select("#drawer-tab-people").style("display") !== "none") drawPerson();
}

// UBI cost = amount per recipient ($K, same units as bracket `top`s) x
// adult population - not yet netted against `data.totals`.
function calculateExpenditure() {
  const recipients = metaFor("general").adultPopulation ?? 0;
  data.expenditures.UBI = (planCurrent.ubi ?? 0) * recipients;
  drawExpenditure();
}

// Mirrors drawTotal() above, but for `data.expenditures`. Unlike
// data.totals, these keys are govtSpending's individual functional
// categories (Health, Education, ...), not one-per-sub-tab - data.govtSpending
// (the detail array calculateMultiComponentTax also writes) still carries
// each one's `group` (core/welfare/other, i.e. which Expenses sub-tab it's
// rendered under), so that's read back out here rather than duplicating the
// grouping. UBI isn't a govtSpending dataset entry at all (see
// calculateExpenditure) - its own control lives on the Income Tax tab, so it
// categorizes there instead of falling into one of the three spending groups.
function drawExpenditure() {
  const groupOf = Object.fromEntries(data.govtSpending.map(e => [e.name, e.group]));
  drawStackedBar(expenditureBar, data.expenditures, {
    domainMax: 200000000,
    formatValue: (v) => `${(v / 1000000).toFixed(2)}B`,
    categoryOf: (name) => groupOf[name] ?? "income",
    categoryLabel: (key) => SPENDING_CATEGORY_LABELS[key] ?? TAX_CATEGORY_LABELS[key] ?? key,
  });
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
  // Pixel y of whichever of bracket i and its neighbour sits further from
  // the zero line (by magnitude, not just "taller"), computed once per
  // bracket rather than per attribute, for sizing a shared-boundary handle
  // that stays draggable even when one side is 0% - or, now that rates can
  // go negative, when one side is negative and the other positive.
  const yScaleRateZero = yScaleRate(0);
  const boundaryY = brackets.map((b, i) => {
    const neighbour = brackets[i + 1]?.percent ?? b.percent;
    const further = Math.abs(b.percent) >= Math.abs(neighbour) ? b.percent : neighbour;
    return yScaleRate(further);
  });

  joinLayerRects(rectLayer, "bracket-rect", brackets,
    (entered) => entered.attr("fill", "none").attr("stroke", "black").attr("stroke-width", 1),
    {
      x: (d, i) => xScale(rectFrom(i)),
      y: d => Math.min(yScaleRate(d.percent), yScaleRateZero),
      width: rectWidth,
      height: d => Math.abs(yScaleRateZero - yScaleRate(d.percent)),
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
      y: (d, i) => Math.min(boundaryY[i], yScaleRateZero),
      height: (d, i) => Math.abs(yScaleRateZero - boundaryY[i]),
    },
    dragRight);

  drawUbiLine(type);
}

// Draws the draggable "minimum income" line for types with a ubiField
// configured (income only) - a no-op for types without one, e.g. wealth.
function drawUbiLine(type) {
  const { ubiField } = bracketConfig[type];
  const { xScale, ubiLineLayer, dragUbi } = bracketPlots[type];
  const lineData = ubiField ? [planCurrent[ubiField] ?? 0] : [];

  const line = ubiLineLayer.selectAll(".ubi-line").data(lineData);
  line.exit().remove();
  line.enter()
    .append("line")
    .attr("class", "ubi-line")
    .attr("stroke", "green").attr("stroke-width", handleWidth).attr("stroke-opacity", 0.4)
    .style("cursor", "col-resize")
    .call(dragUbi)
    .merge(line)
    .attr("x1", d => xScale(d)).attr("x2", d => xScale(d))
    .attr("y1", 0).attr("y2", height);

  const label = ubiLineLayer.selectAll(".ubi-label").data(lineData);
  label.exit().remove();
  label.enter()
    .append("text")
    .attr("class", "ubi-label")
    .attr("text-anchor", "middle")
    .attr("y", -6)
    .merge(label)
    .attr("x", d => xScale(d))
    .text(d => `UBI: $${d.toFixed(1)}K`);

  if (ubiField) {
    d3.select("#ubi-input").property("value", (planCurrent[ubiField] ?? 0).toFixed(1));
  }
}

// People tab: shows how much a single selected person would pay under
// whatever tax plan/settings are currently active. Reuses planCurrent's
// rates directly (via marginalBracketTax/personSlugTake below) rather than
// hand-coding a parallel set of rates, so it stays live as the user edits
// brackets/sliders elsewhere - see drawTotal()'s call to drawPerson().
const personFieldConfig = [
  { field: "income", label: "Annual income", unit: "$" },
  { field: "spending", label: "Annual taxable spending", unit: "$" },
  { field: "netWorth", label: "Net worth", unit: "$" },
  { field: "landValueUrban", label: "Urban land value owned", unit: "$" },
  { field: "landValueRural", label: "Rural land value owned", unit: "$" },
  { field: "vehicles", label: "Vehicles owned", unit: "" },
  { field: "fuelLitres", label: "Petrol used per year", unit: "L" },
  { field: "rucKm", label: "RUC-liable distance per year (diesel/EV)", unit: "km" },
  { field: "cigarettes", label: "Cigarettes smoked per year", unit: "sticks" },
  { field: "alcoholLitres", label: "Pure alcohol consumed per year", unit: "L" },
  { field: "gamingSpend", label: "Gambling machine spend per year", unit: "$" },
  { field: "capitalGains", label: "Capital gains realised per year", unit: "$" },
  { field: "trustIncome", label: "Trustee income per year", unit: "$" },
  { field: "fbtValue", label: "Fringe benefits received per year", unit: "$" },
  { field: "businessTurnover", label: "Business turnover per year", unit: "$" },
  { field: "businessProfit", label: "Business profit per year", unit: "$" },
];

// Person amounts are real dollars (one person), unlike formatBillions()
// which assumes $K-scale aggregate totals - needs its own K/M scaling.
function formatDollars(value) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

// A real marginal-rate calculation, unlike calculateBracketTax()'s
// binned-average approach (only meaningful against aggregate population
// data) - a single person's tax is exact: sum each bracket's rate against
// however much of their value falls inside it. valueK/brackets/floorK are
// all in $K, matching tax_plans.json's bracket "top" convention.
function marginalBracketTax(valueK, brackets, floorK) {
  let tax = 0;
  let from = floorK;
  for (const b of brackets) {
    if (valueK <= from) break;
    tax += (Math.min(valueK, b.top) - from) * (b.percent / 100);
    from = b.top;
  }
  return tax;
}

// A person's version of calculateMultiComponentTax()'s take = value * rate
// / divisor formula. Reads rateDivisor/unit straight off the real dataset
// entry (the same values the aggregate calc uses) rather than duplicating
// them, converts personRealValue (real litres/km/cigarettes/dollars/etc.)
// down to the dataset's own internal unit via the existing UNIT_SCALE table,
// runs the identical formula, then scales the $K-scale result back up to
// real dollars.
function personSlugTake(category, slug, personRealValue) {
  if (!personRealValue) return 0;
  const cfg = multiComponentConfig[category];
  const rate = planCurrent[category]?.[slug];
  const entry = datasetFor(cfg.datasetType).find(e => e.slug === slug);
  if (rate === undefined || !entry) return 0;
  const divisor = entry.rateDivisor ?? 100;
  const multiplier = UNIT_SCALE[entry.components[0]?.unit]?.multiplier ?? 1000;
  return (personRealValue / multiplier) * rate / divisor * 1000;
}

// Only slugs that plausibly apply to an individual get a person field here -
// industrial/producer-side slugs (ETS, waste levy, nitrate charge, work
// levy) are intentionally left unmapped (contribute $0), the same kind of
// documented simplification as the rest of this project's ASSUMPTIONS.md.
function calculatePersonTax(person) {
  const ubiK = planCurrent.ubi ?? 0;
  const incomeTax = marginalBracketTax((person.income ?? 0) / 1000 + ubiK, planCurrent.brackets, 0) * 1000;
  const wealthTax = marginalBracketTax((person.netWorth ?? 0) / 1000, planCurrent.wealthBrackets, bracketConfig.wealth.floor) * 1000;
  const gst = (person.spending ?? 0) * planCurrent.gst / 100;
  const landTax = personSlugTake("land", "urban", person.landValueUrban) + personSlugTake("land", "rural", person.landValueRural);
  const cgt = personSlugTake("otherDirect", "cgt", person.capitalGains);
  const trust = personSlugTake("otherDirect", "trust", person.trustIncome);
  const fbt = personSlugTake("otherDirect", "fbt", person.fbtValue);
  const fuelExcise = personSlugTake("otherIndirect", "fuelExcise", person.fuelLitres);
  const tobaccoExcise = personSlugTake("otherIndirect", "tobaccoExcise", person.cigarettes);
  const alcoholExcise = personSlugTake("otherIndirect", "alcoholExcise", person.alcoholLitres);
  const roadUserCharges = personSlugTake("otherIndirect", "roadUserCharges", person.rucKm);
  const gamingDuty = personSlugTake("otherIndirect", "gamingDuty", person.gamingSpend);
  const earnerLevy = personSlugTake("nonTaxRevenue", "earnerLevy", person.income);
  const mvLevy = personSlugTake("nonTaxRevenue", "mvLevy", person.vehicles);
  const corpLargeThreshold = metaFor("corp").corpLargeThreshold ?? 30000000;
  const corpSlug = (person.businessTurnover ?? 0) > corpLargeThreshold ? "corpLarge" : "corp";
  const corp = personSlugTake("corp", corpSlug, person.businessProfit);

  // Income bar: gross income and benefits received, plain stacked totals -
  // no netting against tax here (that's what the "everything else" bar is
  // for). Mirrors the government Total tab's Revenue bar, which is likewise
  // just a stack of raw totals rather than a gross-to-net waterfall.
  const incomeBar = {
    "Income": person.income ?? 0,
    "Benefits (UBI)": ubiK * 1000,
    "Capital Gains": person.capitalGains ?? 0,
    "Trust Income": person.trustIncome ?? 0,
    "Fringe Benefits": person.fbtValue ?? 0,
    "Business Profit": person.businessProfit ?? 0,
  };

  // Everything else bar: every tax (on income, gains, wealth, and spending
  // alike) plus net spending itself - mirrors the government Total tab's
  // Expenditure bar being a plain stack of its own totals.
  const expenditureBar = {
    "Net Spending": person.spending ?? 0,
    "Income Tax": incomeTax, "Wealth Tax": wealthTax, "Capital Gains Tax": cgt,
    "Trust Tax": trust, "FBT": fbt, "Business/Corp Tax": corp, "ACC Earner's Levy": earnerLevy,
    "GST": gst, "Fuel Excise": fuelExcise, "Tobacco Excise": tobaccoExcise,
    "Alcohol Excise": alcoholExcise, "Gaming Duty": gamingDuty, "Land Tax": landTax,
    "Road User Charges": roadUserCharges, "ACC Vehicle Levy": mvLevy,
  };

  return {
    incomeBar,
    expenditureBar,
  };
}

function drawPersonBreakdownTable(taxes) {
  const rows = d3.select("#person-breakdown-table").select("tbody").selectAll("tr").data(Object.entries(taxes));
  rows.exit().remove();
  rows.enter().append("tr").merge(rows).html(([name, value]) => `
    <td>${name}</td>
    <td>${formatDollars(value)}</td>
  `);
}

function drawPersonFieldsTable() {
  const rows = d3.select("#person-fields-table").select("tbody").selectAll("tr").data(personFieldConfig);
  rows.exit().remove();
  rows.enter().append("tr").merge(rows).html((d) => {
    const prefix = d.unit === "$" ? "$" : "";
    const suffix = d.unit === "$" ? "" : d.unit;
    return `
    <td>${d.label}</td>
    <td>${prefix} <input type="text" inputmode="decimal" value="${personCurrent[d.field] ?? 0}" onchange="changePersonField('${d.field}', this.value)"> ${suffix}</td>
  `;
  });
}

// Redraws the tax-breakdown side of the People tab (portrait/name/bars/
// table) - everything that depends on planCurrent's rates rather than on
// personCurrent's own field values. Deliberately does NOT redraw
// drawPersonFieldsTable() - that only needs to run when personCurrent's
// identity or fields actually change (see its call sites), not on every one
// of the many tax-rate mutations that call this via drawTotal().
// Maps each of calculatePersonTax()'s expenditureBar line items to the
// Tax/Income sub-tab whose settings compute it (mirrors that function's own
// personSlugTake("category", ...) calls). "Net Spending" isn't a tax at all,
// so it's left out - falls back to categorizing under its own name, same as
// personIncomeBar's items below (which don't correspond to any tax sub-tab).
const PERSON_TAX_CATEGORY = {
  "Income Tax": "income", "Wealth Tax": "wealth", "Capital Gains Tax": "otherDirect",
  "Trust Tax": "otherDirect", "FBT": "otherDirect", "Business/Corp Tax": "corp",
  "ACC Earner's Levy": "nonTaxRevenue", "GST": "gst", "Fuel Excise": "otherIndirect",
  "Tobacco Excise": "otherIndirect", "Alcohol Excise": "otherIndirect",
  "Gaming Duty": "otherIndirect", "Land Tax": "land", "Road User Charges": "otherIndirect",
  "ACC Vehicle Levy": "nonTaxRevenue",
};

function drawPerson() {
  const result = calculatePersonTax(personCurrent);

  d3.select("#person-portrait").text(personCurrent.portrait ?? "🧑");
  d3.select("#person-name").text(personCurrent.name);
  d3.select("#person-description").text(personCurrent.description ?? "");

  drawStackedBar(personIncomeBar, result.incomeBar, {
    formatValue: formatDollars,
  });
  drawStackedBar(personExpenditureBar, result.expenditureBar, {
    formatValue: formatDollars,
    categoryOf: (name) => PERSON_TAX_CATEGORY[name] ?? name,
    categoryLabel: (key) => TAX_CATEGORY_LABELS[key] ?? key,
  });

  drawPersonBreakdownTable({ ...result.incomeBar, ...result.expenditureBar });
}

// Predefined people are read-only, same copy-on-write pattern as tax plans
// (ensureCustomPlan/createNewIncomePlan) - the first edit to one clones it
// into a new "Custom Person" entry and repoints personCurrent at the clone.
// A shallow clone is enough here - person objects are flat, no nested arrays.
function createNewCustomPerson() {
  const clone = { ...personCurrent, name: "Custom Person", isCustom: true };
  people.push(clone);
  personCurrent = people[people.length - 1];
  drawPersonDropdown();
}

function ensureCustomPerson() {
  if (!personCurrent.isCustom) createNewCustomPerson();
}

function changePersonField(field, value) {
  ensureCustomPerson();
  personCurrent[field] = parseFloat(value) || 0;
  drawPerson();
  drawPersonFieldsTable();
}

function addCustomPerson() {
  createNewCustomPerson();
  drawPerson();
  drawPersonFieldsTable();
}

// Draw person dropdown - same shape as the Tax Plan selector above.
const drawPersonDropdown = createIndexedDropdown("#person-dropdown-container", "person-dropdown", people, () => personCurrent, (person) => {
  personCurrent = person;
  drawPerson();
  drawPersonFieldsTable();
});

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
  calculateGovtSpending();
  calculateExpenditure();
  drawTotal();
}

drawDropdown();
drawYearDropdown();
drawPersonDropdown();
recalculateAll();
drawPerson();
drawPersonFieldsTable();

// allow access from page
window.changeBracketRange = changeBracketRange;
window.changeBracketPercent = changeBracketPercent;
window.changeUbi = changeUbi;
window.removeBracket = removeBracket;
window.insertBracket = insertBracket;
window.changeGSTRate = changeGSTRate;
window.changeFlatRate = changeFlatRate;
window.changeMultiComponentRate = changeMultiComponentRate;
window.switchTab = switchTab;
window.switchDrawerTab = switchDrawerTab;
window.switchTopTab = switchTopTab;
window.switchExpenseTab = switchExpenseTab;
window.changePersonField = changePersonField;
window.addCustomPerson = addCustomPerson;
window.drawPerson = drawPerson;
