
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";




const datasetFile = "./data/income_2024.json";
const datasetObj = await d3.json(datasetFile);

const incomeDataset = datasetObj.data;
// Main plot window.
const width = 800;
const height = 400;
const margin = 50;

const letters = ["A","B","C","D","E","F","G","H","I","J","K","L","M"];

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
            .attr("y", d => yScaleCount(d.count/(d.to-d.from)))
            .attr("width", d => xScale(d.to-d.from))
            .attr("height", d => height - yScaleCount(d.count/(d.to-d.from)))
            .attr("fill", "red");

// Define tax brackets
let incomeBrackets = [
  {
    name: "31 July 2024 [Current - National]",
    brackets:[
      { id: 0, top: 15.6, percent: 10.5 },
      { id: 1, top: 53.5, percent: 17.5 },
      { id: 2, top: 78.1, percent: 30 },
      { id: 3, top: 180, percent: 33 },
      { id: 4, top: 999999999, percent: 39 }
    ],
    isCustom: false
  },
  {
    name: "2023 [Proposed - Greens]",
    brackets:[
      { id: 0, top: 10, percent: 0 },
      { id: 1, top: 15.6, percent: 10.5 },
      { id: 2, top: 53.5, percent: 17.5 },
      { id: 3, top: 78.1, percent: 30 },
      { id: 4, top: 180, percent: 33 },
      { id: 5, top: 999999999, percent: 45 }
    ],
    isCustom: false
  }
];

let incomeBracketsCurrent = incomeBrackets[0];

let data = {totals: { income: 0, gst:26726000, corporate:16909000, other:7279000 }, income: {brackets:[]}};

//https://www.treasury.govt.nz/sites/default/files/2024-10/fsgnz-2024.pdf

function drawDropdown(){  
  // Redraw the select income tax plan dropdown
  const options = dropdown.selectAll("option").data(incomeBrackets);

  options
    .enter()
    .append("option")
    .merge(options) // Merge enter and update selections
    .text(d => d.name) // Set display text
    .attr("value", (d, i) => i); // Set value
  
  dropdown.node().selectedIndex = incomeBrackets.indexOf(incomeBracketsCurrent);  
  options.exit().remove();
}

function calculateIncomeTax(){
  // Should be called whenever tax brackets changed.
  let cumulative = 0;
  data.income.brackets=[];
  for (let i = 0; i < incomeBracketsCurrent.brackets.length; i++) {
    // Find bottom of this bracket.
    let from = (i==0) ? 0 : incomeBracketsCurrent.brackets[i-1].top;
    let maxTaxable = incomeBracketsCurrent.brackets[i].top * incomeBracketsCurrent.brackets[i].percent/100;
    // Ignore entries under this bracket and sum max taxable amount otherwise.
    const {count, take} = incomeDataset.filter(e => (e.from > from)).reduce((a,b)=> {
      a.count += b.count;
      a.take += b.count * ((incomeBracketsCurrent.brackets[i].percent/100) * Math.min(b.avg, i == incomeBracketsCurrent.brackets.length-1 ? Infinity : incomeBracketsCurrent.brackets[i].top));
      return a;
    },{count:0, take:0})
    cumulative += take;
    data.income.brackets.push({ref: incomeBracketsCurrent.brackets[i], max: maxTaxable, count: count, take: take})
  }
  data.totals.income = cumulative;
  drawTotal();
  drawBracket();
  drawTable();
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


function createNewIncomePlan(){
  incomeBrackets.push({name:"Custom Plan", brackets: structuredClone(incomeBracketsCurrent.brackets), isCustom: true})
  incomeBracketsCurrent = incomeBrackets[incomeBrackets.length-1];
  drawDropdown();
}


function insertIncomeBracket(){
  if (!incomeBracketsCurrent.isCustom){createNewIncomePlan()}
  // Get range of second to last bracket.
  const bracketEnd = incomeBracketsCurrent.brackets[incomeBracketsCurrent.brackets.length -2].top;
  incomeBracketsCurrent.brackets[incomeBracketsCurrent.brackets.length -1].top = bracketEnd + ((xScale.domain()[1] - bracketEnd) / 2);
  incomeBracketsCurrent.brackets.push({ id: 0, top: 999999999, percent: incomeBracketsCurrent.brackets[incomeBracketsCurrent.brackets.length -1].percent + 5 })
  incomeBracketsCurrent.brackets.map((v, i)=> {v.id = i}); // re-index
  calculateIncomeTax();
}
function removeIncomeBracket(i){
  if (!incomeBracketsCurrent.isCustom){createNewIncomePlan()}
  incomeBracketsCurrent.brackets.splice(i,1);
  incomeBracketsCurrent.brackets.map((v, i)=> {v.id = i}); // re-index
  calculateIncomeTax();
}

export function changeIncomeBracketPercent(bracket, value){
  // Called when income bracket percentage is changed.
  if (!incomeBracketsCurrent.isCustom){
    // If looking at predefined bracket, add new 'custom', then edit that.
    createNewIncomePlan()
  }
  incomeBracketsCurrent.brackets[bracket].percent = Math.max(Math.min(100, Math.max(parseFloat(value), -100)),0);
  // TODO: allow negative tax range.
  calculateIncomeTax();
}
export function changeIncomeBracketRange(bracket, value){
  // Called when income bracket range is changed.
  if (!incomeBracketsCurrent.isCustom){
    // If looking at predefined bracket, add new 'custom', then edit that.
    createNewIncomePlan()
  }
  incomeBracketsCurrent.brackets[bracket].top = Math.max(parseFloat(value), (bracket < 1) ? 0 : incomeBracketsCurrent.brackets[bracket-1].top+1);
  calculateIncomeTax();
}

function drawTable() {
  // Create a table to display rectangle dimensions
  const container = d3.select("#income-bracket-table-container");

  // Update rows in tbody
  const rowsSelection = container.select("tbody").selectAll("tr").data(incomeBracketsCurrent.brackets)
    
  rowsSelection
    .enter()
    .append("tr")
    .merge(rowsSelection)
    .html((d,i) => `
       <td>${letters[i]}</td>
       <td>$${i < 1 ? 0 : incomeBracketsCurrent.brackets[i-1].top.toFixed(2) }K</td>
       <td>${i == incomeBracketsCurrent.brackets.length -1 ? "--" : `
        $ <input
        class="income-bracket-range"
        type="number"
        min="${i == 0 ? 10 : incomeBracketsCurrent.brackets[i-1].top + 10}"
        value=${d.top.toFixed(2)}
        oninput="changeIncomeBracketRange(${i}, this.value)"> K</td>`
       }
       <td><input class="income-bracket-percent" type="number" min=0 max=100 value=${d.percent.toFixed()} oninput="changeIncomeBracketPercent(${i}, this.value)"> %</td>
       <td>${data.income.brackets[i].count}</td>
       <td>$${(data.income.brackets[i].take/1000000).toFixed(2) + "B"}B</td>
       <td>${i > 0 ? "<button onclick=removeIncomeBracket(${i})>x</button>" : ""}</td>
    `)
  const addButton = d3.select("#income-bracket-add");
  if (incomeBracketsCurrent.brackets.length > 11){
    addButton.attr('disabled', true);
    addButton.attr('title', 'Thats enough..')
  }else{
    addButton.attr('disabled', null);
    addButton.attr('title', 'Add a new income bracket.')
  }

// Remove old rows
rowsSelection.exit().remove();

  //.on("change", function (event, d) {
  //   const newXRight = +event.target.value;
  //   const diff = newXRight - (d.x + d.width);
  //   d.width += diff;

  //   // Update linked rectangle
  //   const nextRect = brackets[brackets.indexOf(d) + 1];
  //   if (nextRect) {
  //     nextRect.x += diff;
  //     nextRect.width -= diff;
  //   }
  // });
}

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



function drawTotal(){

  //let data =  [{name: "gst", value: 3000}, {name:"income", value: 5000}];
  
  let cumulative = 0;

  const stackedData = Object.entries(data.totals).map((k) => ({
    name: k[0],
    value: k[1],
    start: cumulative,
    end: (cumulative += k[1]),
  }));

      totalXScale.domain(["Total"]);
      totalYScale.domain([0, 200000000 ]);
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
        .text(d => d.name + "\n" + (d.value / 1000000).toFixed(2) + "B")

      totalPlot.selectAll(".y-axis").remove();
}


// Add drag behaviors
const dragUp = d3.drag()
  .on("drag", function (event, d) {
    changeIncomeBracketPercent(d.id,yScaleRate.invert(event.y))
  });

const dragRight = d3.drag()
.on("drag", function (event, d) {
  changeIncomeBracketRange(d.id, xScale.invert(event.x))
});

function drawBracket(){
  // Draw rectangles
  const rectGroupUpdate = incomePlot.selectAll(".rect-group")
    .data(incomeBracketsCurrent.brackets)

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
    .attr("x", (d, i) => xScale((i < 1) ? 0 : incomeBracketsCurrent.brackets[i-1].top))
    .attr("y", d => yScaleRate(d.percent))
    .attr("width", (d, i) => ( 
      xScale(
        i < 1                   ? d.top                               : // If first bracket
        i == incomeBracketsCurrent.brackets.length -1 ? 100000 : // If last bracket
        +d.top - incomeBracketsCurrent.brackets[i-1].top
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
      .attr("y", function (d,i) {
        return (height - this.parentNode.getElementsByTagName("rect")[0].getAttribute('height') - (handleWidth/2))
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
        return (+this.parentNode.getElementsByTagName("rect")[0].getAttribute("x") + +this.parentNode.getElementsByTagName("rect")[0].getAttribute('width') -(handleWidth/2))
      })
      .attr("width", (d, i) => ((i < incomeBracketsCurrent.brackets.length-1) ? handleWidth : 0))
      .attr("y", function () {
        return (height - this.parentNode.getElementsByTagName("rect")[0].getAttribute("height"))
      })
      .attr("height", function () {
        // TODO: Select largest of side.
        return (this.parentNode.getElementsByTagName("rect")[0].getAttribute("height"))
      })
      .call(dragRight);
}

const dropdownContainer = d3.select("#dropdown-container");
const dropdown = dropdownContainer
  .append("select")
  .attr("id", "dropdown-menu")
  .on("change", function() {
    incomeBracketsCurrent = incomeBrackets[this.value];
    calculateIncomeTax();
  });

drawDropdown();
calculateIncomeTax();

// allow access from page
window.changeIncomeBracketRange = changeIncomeBracketRange;
window.changeIncomeBracketPercent = changeIncomeBracketPercent;
window.removeIncomeBracket = removeIncomeBracket;
window.insertIncomeBracket = insertIncomeBracket;