
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

async function loadDataset(path) {
  return (await d3.json(path)).data;
}

// Datasets that have more than one year available are keyed by year;
// datasets with only a single vintage (or a modelled/estimated base rather
// than an annual release) keep whatever key they were given - see TODO.md
// for why each of these can't yet go further than what's loaded here.
const datasets = {
  income: {
    2024: await loadDataset("./data/income_2024.json"),
    2025: await loadDataset("./data/income_2025.json"),
  },
  gst: {
    2024: await loadDataset("./data/gst_2024.json"),
    2025: await loadDataset("./data/gst_2025.json"),
  },
  corp: {
    2024: await loadDataset("./data/corp_2024.json"),
    2025: await loadDataset("./data/corp_2025.json"),
  },
  fuelEts: {
    2024: await loadDataset("./data/fuelets_2024.json"),
    2025: await loadDataset("./data/fuelets_2025.json"),
  },
  trust: { 2024: await loadDataset("./data/trust_2024.json") },
  wealth: { 2024: await loadDataset("./data/wealth_2024.json") },
  cgt: { estimate: await loadDataset("./data/cgt_estimate.json") },
  land: { estimate: await loadDataset("./data/land_estimate.json") },
};

const availableYears = [2024, 2025];
let currentYear = 2025;

// Resolves the dataset for `type` at the currently selected year, falling
// back to whatever single vintage that type has (trust/wealth/cgt/land).
function datasetFor(type) {
  const years = datasets[type];
  return years[currentYear] ?? years[Object.keys(years)[0]];
}

const plans = (await d3.json("./data/tax_plans.json")).plans;
// Preprocces
plans.forEach(a => {
  a.isCustom = false;
  a.brackets.forEach((b, i) => {
    b.id = i;
  })
});

let planCurrent = plans[0];

// "other" indirect taxation (from Treasury's FY2024 financial statements)
// substantially overlaps with what we now model explicitly as Fuel Excise
// Duty + ETS revenue below - it's been reduced by that FY2024 accrual total
// to avoid double-counting the same revenue in the stacked total chart. This
// is an approximation (receipts vs accrual basis, and it doesn't flex with
// the year selector) - see TODO.md.
const otherTaxBaseline = 7279000 - (2002000 + 1690000);

let data = {
  totals: { income: 0, gst: 0, corporate: 0, other: otherTaxBaseline, cgt: 0, trust: 0, wealth: 0, land: 0, fuelEts: 0 },
  income: { brackets: [] },
  gst: [],
  corp: [],
  cgt: [],
  trust: [],
  wealth: [],
  land: [],
  fuelEts: []
};

//https://www.treasury.govt.nz/sites/default/files/2024-10/fsgnz-2024.pdf

// Main plot window.
const width = 800;
const height = 400;
const margin = 50;

const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

const handleWidth = 12;

const incomePlot = d3
  .select("#plot-container")
  .append("svg")
  .attr("width", width + margin * 2)
  .attr("height", height + margin * 2)
  .append("g")
  .attr("transform", `translate(${margin}, ${margin})`);

//d3.max(dataset, d => d.to)
// Create scales for the chart
const xScale = d3.scaleLinear().domain([0, 300]).range([0, width]);
const yScaleRate = d3.scaleLinear().domain([0, 100]).range([height, 0]);
const yScaleCount = d3.scaleLinear().domain([0, d3.max(datasetFor("income"), d => d.count)]).range([height, 0]);

// Add axes
incomePlot.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale));
incomePlot.append("g").attr("class", "y-axis").call(d3.axisLeft(yScaleRate));
const yAxisCount = incomePlot.append("g").attr("class", "y-axis").attr("transform", `translate(${width},0)`).call(d3.axisRight(yScaleCount));

// Plot income data
const incomeDataContainer = incomePlot.append("g").attr("id", "income-container");

function drawIncomeHistogram() {
  // Redraw the background wage/salary distribution bars for the current year.
  const dataset = datasetFor("income");
  yScaleCount.domain([0, d3.max(dataset, d => d.count)]);
  yAxisCount.call(d3.axisRight(yScaleCount));

  const incomeDataSelection = incomeDataContainer
    .selectAll(".bar")
    .data(dataset);

  incomeDataSelection
    .enter()
    .append("rect")
    .attr("class", "bar")
    .merge(incomeDataSelection)
    .attr("x", d => xScale(d.from))
    .attr("y", d => yScaleCount(d.count / (d.to - d.from)))
    .attr("width", d => xScale(d.to - d.from))
    .attr("height", d => height - yScaleCount(d.count / (d.to - d.from)))
    .attr("fill", "lightblue");

  incomeDataSelection.exit().remove();
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

// Draw dataset-year dropdown (a plain sibling of the plan dropdown, matching
// the existing flex-row layout of #dropdown-container rather than nesting a
// second flex context inside it).
dropdownContainer.append("h2").text("Data year:");
const yearDropdown = dropdownContainer
  .append("select")
  .attr("id", "year-dropdown")
  .on("change", function () {
    currentYear = parseInt(this.value, 10);
    drawIncomeHistogram();
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

function calculateIncomeTax() {
  // Should be called whenever tax brackets changed.
  const incomeDataset = datasetFor("income");
  let cumulative = 0;
  data.income.brackets = [];
  for (let i = 0; i < planCurrent.brackets.length; i++) {
    // Find bottom of this bracket.
    let from = (i == 0) ? 0 : planCurrent.brackets[i - 1].top;
    let maxTaxable = planCurrent.brackets[i].top * planCurrent.brackets[i].percent / 100;
    // Ignore entries under this bracket and sum max taxable amount otherwise.
    const { count, take } = incomeDataset.filter(e => (e.from > from)).reduce((a, b) => {
      a.count += b.count;
      a.take += b.count * ((planCurrent.brackets[i].percent / 100) * (Math.min(b.avg, planCurrent.brackets[i].top) - (i == 0 ? 0 : planCurrent.brackets[i - 1].top)));
      return a;
    }, { count: 0, take: 0 })
    cumulative += take;
    data.income.brackets.push({ ref: planCurrent.brackets[i], max: maxTaxable, count: count, take: take })
  }
  data.totals.income = cumulative;
  drawIncomeBracket();
  drawIncomeTable();
}

// --- Flat-rate tax types: a single rate applied against a dataset of named
// values (GST, Capital Gains Tax, Trust tax). CGT/Trust reuse the exact
// mechanics GST already had; only the config below differs per type.
const flatRateConfig = {
  gst: { datasetType: "gst", containerId: "#gst-table-container", sliderId: "#sliderGst", rateField: "gst" },
  cgt: { datasetType: "cgt", containerId: "#cgt-table-container", sliderId: "#sliderCgt", rateField: "cgt" },
  trust: { datasetType: "trust", containerId: "#trust-table-container", sliderId: "#sliderTrust", rateField: "trust" },
};

function calculateFlatRateTax(category) {
  const { datasetType, rateField } = flatRateConfig[category];
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
}

function drawFlatRateTable(category) {
  const { containerId, sliderId, rateField } = flatRateConfig[category];

  const rowsSelection = d3.select(containerId).select("tbody").selectAll("tr").data(data[category]);

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d) => `
         <td>${d.name}</td>
         <td>$${(d.total / 1000000).toFixed(2)}B</td>
         <td>${planCurrent[rateField]}%</td>
         <td>$${((d.take / 1000000).toFixed(2))}B</td>
      `)

  rowsSelection.exit().remove();

  const slider = d3.select(sliderId);
  slider.attr("value", planCurrent[rateField]);
}

function changeFlatRate(category, value) {
  if (!planCurrent.isCustom) { createNewIncomePlan() }
  planCurrent[flatRateConfig[category].rateField] = Math.max(0, Math.min(100, parseFloat(value)));
  calculateFlatRateTax(category);
  drawTotal();
}

const calculateGST = () => calculateFlatRateTax("gst");
const calculateCGT = () => calculateFlatRateTax("cgt");
const calculateTrust = () => calculateFlatRateTax("trust");

// --- Multi-component tax types: several named/independently-rated
// categories, each with its own dataset "slug" (Corporate tax, Land tax,
// Fuel Excise & ETS). Land/Fuel-ETS reuse the exact mechanics Corp already
// had; only the config below differs per type.
const multiComponentConfig = {
  corp: { datasetType: "corp", containerId: "#corp-table-container" },
  land: { datasetType: "land", containerId: "#land-table-container" },
  fuelEts: { datasetType: "fuelEts", containerId: "#fuelets-table-container" },
};

function calculateMultiComponentTax(category) {
  const { datasetType } = multiComponentConfig[category];
  const dataset = datasetFor(datasetType);
  const rates = planCurrent[category];

  let cumulativeTake = 0;
  const result = dataset.map(entry => {
    let components = [];
    entry.components.forEach(x => {
      let take = x.value * rates[entry.slug] / 100;
      components.push({ name: x.name, total: x.value, take: take });
      cumulativeTake += take;
    });
    return { name: entry.name, description: entry.description, components: components, slug: entry.slug };
  });

  data[category] = result;
  data.totals[category] = cumulativeTake;
  drawMultiComponentTable(category);
}

function drawMultiComponentTable(category) {
  const { containerId } = multiComponentConfig[category];

  // Group-level (one per dataset category, e.g. one per corp/land/fuelEts
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

  containersEnter
    .append("div")
    .attr("class", "slidecontainer")
    .append("input")
    .attr("type", "range")
    .attr("min", 0)
    .attr("max", 100)
    .attr("step", 0.1)
    .attr("class", "slider")
    .attr("id", (d) => `slider-${category}-${d.slug}`)
    .attr("oninput", (d) => `changeMultiComponentRate('${category}', '${d.slug}', this.value)`)

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
    .property("value", (d) => planCurrent[category][d.slug]);

  const tablerowsUpdate = containersMerged.select("tbody").selectAll("tr").data((d) => d.components);

  tablerowsUpdate.exit().remove();

  tablerowsUpdate
    .enter()
    .append("tr")
    .merge(tablerowsUpdate)
    .html((d) => `
      <td>${d.name}</td>
      <td>$${(d.total / 1000000).toFixed(2)}B</td>
      <td>$${(d.take / 1000000).toFixed(2)}B</td>
    `)
}

function changeMultiComponentRate(category, tid, value) {
  if (!planCurrent.isCustom) { createNewIncomePlan() }
  planCurrent[category][tid] = Math.max(0, Math.min(100, parseFloat(value)));
  calculateMultiComponentTax(category);
  drawTotal();
}

const calculateCorp = () => calculateMultiComponentTax("corp");
const calculateLand = () => calculateMultiComponentTax("land");
const calculateFuelEts = () => calculateMultiComponentTax("fuelEts");

function changeCorpRate(value, tid) {
  // Kept for backwards compatibility with the corp tab's existing markup.
  changeMultiComponentRate("corp", tid, value);
}

// --- Wealth tax: a single threshold + flat rate applied above that
// threshold, against a dataset of net-worth bands (shaped like the income
// dataset). Every real wealth tax policy found in research is a single
// threshold+rate, not an arbitrary bracket ladder, so this doesn't reuse the
// income bracket/chart machinery - see the implementation plan for why.
function calculateWealthTax() {
  const dataset = datasetFor("wealth");
  const { threshold, percent } = planCurrent.wealth;

  let cumulativeTake = 0;
  const items = dataset.map(band => {
    const taxableAvg = Math.max(0, band.avg - threshold);
    const take = taxableAvg * band.count * (percent / 100);
    cumulativeTake += take;
    return { from: band.from, to: band.to, count: band.count, avg: band.avg, take: take };
  });

  data.wealth = items;
  data.totals.wealth = cumulativeTake;
  drawWealthTable();
}

function drawWealthTable() {
  const rowsSelection = d3.select("#wealth-table-container").select("tbody").selectAll("tr").data(data.wealth);

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d) => `
      <td>$${d.from}K - ${d.to >= 999999999 ? "&infin;" : "$" + d.to + "K"}</td>
      <td>${d.count}</td>
      <td>$${d.avg.toFixed(2)}K avg</td>
      <td>$${(d.take / 1000000).toFixed(2)}B</td>
    `)

  rowsSelection.exit().remove();

  d3.select("#wealth-threshold").property("value", planCurrent.wealth.threshold);
  d3.select("#wealth-percent").property("value", planCurrent.wealth.percent);
}

function changeWealthThreshold(value) {
  if (!planCurrent.isCustom) { createNewIncomePlan() }
  planCurrent.wealth.threshold = Math.max(0, parseFloat(value));
  calculateWealthTax();
  drawTotal();
}

function changeWealthPercent(value) {
  if (!planCurrent.isCustom) { createNewIncomePlan() }
  planCurrent.wealth.percent = Math.max(0, Math.min(100, parseFloat(value)));
  calculateWealthTax();
  drawTotal();
}

function createNewIncomePlan() {
  plans.push({
    name: "Custom Plan",
    brackets: structuredClone(planCurrent.brackets),
    gst: planCurrent.gst,
    corp: structuredClone(planCurrent.corp),
    cgt: planCurrent.cgt,
    trust: planCurrent.trust,
    wealth: structuredClone(planCurrent.wealth),
    land: structuredClone(planCurrent.land),
    fuelEts: structuredClone(planCurrent.fuelEts),
    isCustom: true
  })
  planCurrent = plans[plans.length - 1];
  drawDropdown();
}
function insertIncomeBracket() {
  if (!planCurrent.isCustom) { createNewIncomePlan() }

  // If only one bracket, just add a new one at half way.
  if (planCurrent.brackets.length === 1) {
    planCurrent.brackets[0].top = (xScale.domain()[1]/2);
  }else{
    // Get range of second to last bracket.
    const bracketEnd = planCurrent.brackets[planCurrent.brackets.length - 2].top;
    planCurrent.brackets[planCurrent.brackets.length - 1].top = bracketEnd + ((xScale.domain()[1] - bracketEnd) / 2);
  }
  planCurrent.brackets.push({ id: 0, top: 999999999, percent: planCurrent.brackets[planCurrent.brackets.length - 1].percent + 5 })
  planCurrent.brackets.map((v, i) => { v.id = i }); // re-index
  calculateIncomeTax();
}
function removeIncomeBracket(i) {
  if (!planCurrent.isCustom) { createNewIncomePlan() }
  planCurrent.brackets.splice(i, 1);
  planCurrent.brackets.map((v, i) => { v.id = i }); // re-index
  planCurrent.brackets[planCurrent.brackets.length - 1].top = 999999999;
  calculateIncomeTax();
}
function changeIncomeBracketPercent(bracket, value) {
  // Called when income bracket percentage is changed.
  if (!planCurrent.isCustom) {
    // If looking at predefined bracket, add new 'custom', then edit that.
    createNewIncomePlan()
  }
  planCurrent.brackets[bracket].percent = Math.max(Math.min(100, Math.max(parseFloat(value), -100)), 0);
  // TODO: allow negative tax range.
  calculateIncomeTax();
}
function changeIncomeBracketRange(bracket, value) {
  // Called when income bracket range is changed.
  if (!planCurrent.isCustom) {
    // If looking at predefined bracket, add new 'custom', then edit that.
    createNewIncomePlan()
  }
  planCurrent.brackets[bracket].top = Math.max(parseFloat(value), (bracket < 1) ? 0 : planCurrent.brackets[bracket - 1].top + 1);
  calculateIncomeTax();
}

function changeGSTRate(value) {
  changeFlatRate("gst", value);
}

function drawIncomeTable() {
  // Create a table to display rectangle dimensions
  const container = d3.select("#income-bracket-table-container");

  // Update rows in tbody
  const rowsSelection = container.select("tbody").selectAll("tr").data(planCurrent.brackets)

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d, i) => `
       <td>${letters[i]}</td>
       <td>$${i < 1 ? 0 : planCurrent.brackets[i - 1].top.toFixed(2)}K</td>
       <td>${i == planCurrent.brackets.length - 1 ? "--" : `
        $ <input
        class="income-bracket-range"
        type="number"
        min="${i == 0 ? 10 : planCurrent.brackets[i - 1].top + 10}"
        value=${d.top.toFixed(2)}
        oninput="changeIncomeBracketRange(${i}, this.value)"> K</td>`
      }
       <td><input class="income-bracket-percent" type="number" min=0 max=100 value=${d.percent.toFixed()} oninput="changeIncomeBracketPercent(${i}, this.value)"> %</td>
       <td>${data.income.brackets[i].count}</td>
       <td>$${(data.income.brackets[i].take / 1000000).toFixed(2)}B</td>
       <td>${i > 0 ? "<button onclick=removeIncomeBracket(" + i + ")>x</button>" : ""}</td>
    `)
  const addButton = d3.select("#income-bracket-add");
  if (planCurrent.brackets.length > 11) {
    addButton.attr('disabled', true);
    addButton.attr('title', 'Thats enough..')
  } else {
    addButton.attr('disabled', null);
    addButton.attr('title', 'Add a new income bracket.')
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

function drawIncomeBracket() {

  // Add drag behaviors
  const dragUp = d3.drag()
    .on("drag", function (event, d) {
      changeIncomeBracketPercent(d.id, yScaleRate.invert(event.y))
    });

  const dragRight = d3.drag()
    .on("drag", function (event, d) {
      changeIncomeBracketRange(d.id, xScale.invert(event.x))
    });

  // Draw rectangles
  const rectGroupUpdate = incomePlot.selectAll(".rect-group")
    .data(planCurrent.brackets)

  rectGroupUpdate.exit().remove();

  const rectGroupEnter = rectGroupUpdate.enter()
    .append("g")
    .attr("class", "rect-group");

  const rectGroupMerged = rectGroupEnter
    .append("rect")
    .attr("fill", "none")
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .merge(rectGroupUpdate.select("rect"))

  rectGroupMerged
    .attr("x", (d, i) => xScale((i < 1) ? 0 : planCurrent.brackets[i - 1].top))
    .attr("y", d => yScaleRate(d.percent))
    .attr("width", (d, i) => (
      xScale(
        i < 1 ? d.top : // If first bracket
          i == planCurrent.brackets.length - 1 ? 100000 : // If last bracket
            +d.top - planCurrent.brackets[i - 1].top
      )))
    .attr("height", d => yScaleRate(0) - yScaleRate(d.percent))

  // Add top handle.
  rectGroupEnter
    .append("rect")
    .attr("class", "handle-top")
    .attr("fill", "transparent")
    .style("cursor", "row-resize")
    .merge(rectGroupUpdate.select(".handle-top"))
    .attr("x", function () {
      return (this.parentNode.getElementsByTagName("rect")[0].getAttribute("x"))
    })
    .attr("width", function () {
      return (this.parentNode.getElementsByTagName("rect")[0].getAttribute("width"))
    })
    .attr("y", function () {
      return (height - this.parentNode.getElementsByTagName("rect")[0].getAttribute('height') - (handleWidth / 2))
    })
    .attr("height", handleWidth)
    .call(dragUp);

  // Add right handle.
  rectGroupEnter
    .append("rect")
    .attr("class", "handle-right")
    .attr("fill", "transparent")
    //.attr("r", (d, i) => ((i < brackets.length-1) ? 8 : 0))
    .style("cursor", "col-resize")
    .merge(rectGroupUpdate.select(".handle-right"))
    .attr("x", function () {
      return (+this.parentNode.getElementsByTagName("rect")[0].getAttribute("x") + +this.parentNode.getElementsByTagName("rect")[0].getAttribute('width') - (handleWidth / 2))
    })
    .attr("width", (d, i) => ((i < planCurrent.brackets.length - 1) ? handleWidth : 0))
    .attr("y", function () {
      return (height - this.parentNode.getElementsByTagName("rect")[0].getAttribute("height"))
    })
    .attr("height", function () {
      // TODO: Select largest of side.
      return (this.parentNode.getElementsByTagName("rect")[0].getAttribute("height"))
    })
    .call(dragRight);
}

function recalculateAll() {
  calculateIncomeTax();
  calculateGST();
  calculateCorp();
  calculateCGT();
  calculateTrust();
  calculateLand();
  calculateFuelEts();
  calculateWealthTax();
  drawTotal();
}

drawDropdown();
drawYearDropdown();
drawIncomeHistogram();
recalculateAll();

// allow access from page
window.changeIncomeBracketRange = changeIncomeBracketRange;
window.changeIncomeBracketPercent = changeIncomeBracketPercent;
window.removeIncomeBracket = removeIncomeBracket;
window.insertIncomeBracket = insertIncomeBracket;
window.changeGSTRate = changeGSTRate;
window.changeCorpRate = changeCorpRate;
window.changeFlatRate = changeFlatRate;
window.changeMultiComponentRate = changeMultiComponentRate;
window.changeWealthThreshold = changeWealthThreshold;
window.changeWealthPercent = changeWealthPercent;
window.switchTab = switchTab;
