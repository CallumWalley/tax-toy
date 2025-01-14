
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

const incomeDataset = (await d3.json("./data/income_2024.json")).data;
const gstDataset = (await d3.json("./data/gst_2024.json")).data;
const corpDataset = (await d3.json("./data/corp_2024.json")).data;


const plans = (await d3.json("./data/tax_plans.json")).plans;
// Preprocces
plans.forEach(a => {
  a.isCustom = false;
  a.brackets.forEach((b, i) => {
    b.id = i;
  })
});

let planCurrent = plans[0];

let data = {
  totals: { income: 0, gst: 0, corporate: 0, other: 7279000 },
  income: { brackets: [] },
  gst: [],
  corp: []
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
const yScaleCount = d3.scaleLinear().domain([0, d3.max(incomeDataset, d => d.count)]).range([height, 0]);

// Add axes
incomePlot.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(d3.axisBottom(xScale));
incomePlot.append("g").attr("class", "y-axis").call(d3.axisLeft(yScaleRate));
incomePlot.append("g").attr("class", "y-axis").attr("transform", `translate(${width},0)`).call(d3.axisRight(yScaleCount));


// Plot income data
const incomeDataContainer = incomePlot.append("g").attr("id", "income-container");
const incomeDataSelection = incomeDataContainer
  .selectAll(".bar")
  .data(incomeDataset)

incomeDataSelection
  .enter()
  .append("rect")
  .attr("class", "bar")
  .merge(incomeDataSelection)
  .attr("x", d => xScale(d.from))
  .attr("y", d => yScaleCount(d.count / (d.to - d.from)))
  .attr("width", d => xScale(d.to - d.from))
  .attr("height", d => height - yScaleCount(d.count / (d.to - d.from)))
  .attr("fill", "red");

// Draw total plot
const totalPlot = d3.select("#total-container")
  .append("svg")
  .attr("width", 200)
  .attr("height", 500);

const totalXScale = d3.scaleBand()
  .range([0, 180])
  .padding(0.1);

const totalYScale = d3.scaleLinear()
  .range([450, 0]);

const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
totalPlot.append("g").attr("class", "y-axis").attr("transform", `translate(170,0)`).call(d3.axisRight(totalYScale));

// Draw dropdown
const dropdownContainer = d3.select("#dropdown-container");
const dropdown = dropdownContainer
  .append("select")
  .attr("id", "dropdown-menu")
  .on("change", function () {
    planCurrent = plans[this.value];
    calculateIncomeTax();
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

function calculateIncomeTax() {
  // Should be called whenever tax brackets changed.
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
  drawTotal();
  drawIncomeBracket();
  drawIncomeTable();
  // d.id, (d.id < 1) ? "$0" : "$" + incomeBracketsCurrent.brackets[d.id-1].top + "K",
  //     d.id == incomeBracketsCurrent.brackets.length -1 ? "--" : "$" + d.top + "K", 
  //     d.percent, 
  //     dataset.filter(e => (
  //       (e.from >= (d.id == 0 ? 0 : incomeBracketsCurrent.brackets[d.id-1].top)+1))).reduce((a,b)=>a+b.count, 0),
  //     "$" + (dataset.filter(e => (
  //       (+e.from > (d.id == 0 ? 0 : +incomeBracketsCurrent.brackets[d.id-1].top))))
  //       .reduce((a,b)=>a+ (b.count * ((+d.percent/100) * Math.min(+b.avg, +d.top)) / 1000000), 0)
  //       ).toFixed(2)+"B"].join('</td><td>') + '</td>')
}

function calculateGST() {
  data.gst = []

  let cumulativeTake = 0;

  for (let i = 0; i < gstDataset.length; i++) {
    cumulativeTake += gstDataset[i].value * (planCurrent.gst/100);
    data.gst.push({ name: gstDataset[i].name, total: gstDataset[i].value, take: gstDataset[i].value * (planCurrent.gst/100) });
  }

  data.totals.gst = cumulativeTake;
  drawGSTTable();
}
function calculateCorp() {
  data.corp = []

  let cumulativeTake = 0;

  for (let i = 0; i < corpDataset.length; i++) {
    cumulativeTake += corpDataset[i].value * (planCurrent.corp.standard/100);
    data.corp.push({ name: corpDataset[i].name, total: corpDataset[i].value, take: corpDataset[i].value * (planCurrent.corp.standard/100) });
  }

  data.totals.corporate = cumulativeTake;
  drawCorpTable();
}
function createNewIncomePlan() {
  plans.push({ 
    name: "Custom Plan", 
    brackets: structuredClone(planCurrent.brackets), 
    gst: structuredClone(planCurrent.gst), 
    corp: structuredClone(planCurrent.corp), 
    isCustom: true })
  planCurrent = plans[plans.length - 1];
  drawDropdown();
}
function insertIncomeBracket() {
  if (!planCurrent.isCustom) { createNewIncomePlan() }
  // Get range of second to last bracket.
  const bracketEnd = planCurrent.brackets[planCurrent.brackets.length - 2].top;
  planCurrent.brackets[planCurrent.brackets.length - 1].top = bracketEnd + ((xScale.domain()[1] - bracketEnd) / 2);
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
  if (!planCurrent.isCustom) {createNewIncomePlan()}
  planCurrent.gst = value;
  calculateGST();
  drawTotal();
}

function changeCorpRate(value) {
  if (!planCurrent.isCustom) {createNewIncomePlan()}
  planCurrent.corp.standard = value;
  calculateCorp();
  drawTotal();
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

function drawGSTTable() {
  const container = d3.select("#gst-table-container");

  // Update rows in tbody
  const rowsSelection = container.select("tbody").selectAll("tr").data(data.gst.concat([{ name: "Total", total: "", take: data.totals.gst }]))

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d) => `
         <td>${d.name}</td>
         <td>$${(d.total/1000000).toFixed(2)}B</td>
         <td>${planCurrent.gst}%</td>
         <td>$${((d.take/1000000).toFixed(2))}B</td>
      `)
  
  const slider = d3.select("#sliderGst");
  slider.attr("value", planCurrent.gst);
  
}
function drawCorpTable() {
  const container = d3.select("#corp-table-container");

  // Update rows in tbody
  const rowsSelection = container.select("tbody").selectAll("tr").data(data.corp.concat([{ name: "Total", total: "", take: data.totals.corporate }]))

  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d) => `
         <td>${d.name}</td>
         <td>$${(d.total/1000000).toFixed(2)}B</td>
         <td>${planCurrent.corp.standard}%</td>
         <td>$${((d.take/1000000).toFixed(2))}B</td>
      `)
  
  const slider = d3.select("#sliderCorp");
  slider.attr("value", planCurrent.corp.standard);
  
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
  colorScale.domain(Object.keys(data));

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

drawDropdown();
calculateGST();
calculateCorp();

calculateIncomeTax();

// allow access from page
window.changeIncomeBracketRange = changeIncomeBracketRange;
window.changeIncomeBracketPercent = changeIncomeBracketPercent;
window.removeIncomeBracket = removeIncomeBracket;
window.insertIncomeBracket = insertIncomeBracket;
window.changeGSTRate = changeGSTRate;
window.changeCorpRate = changeCorpRate;
window.switchTab = switchTab;