# TODO

Planned features and open follow-ups for this simulator. See
`ASSUMPTIONS.md` for known data gaps and modelling simplifications behind
the current datasets.

## Wealth tax could be a slider overlay on a plot

## Other Treasury revenue categories found but not modeled

Researching FSGNZ surfaced several more Treasury revenue lines with no tab
in this simulator at all: Fire and Emergency levies, EQC/Natural Hazards
Commission levies, the Clean Vehicle Discount (a rebate, negative revenue),
and an "Other miscellaneous items" catch-all - all under "Other Sovereign
Revenue" in FSGNZ, alongside ACC levies and ETS. None of these are counted
anywhere in this simulator (not even folded into `other`, which is scoped
to "Other Indirect Taxation" specifically). Candidates for future tabs if
more completeness is wanted.

## Net expenditure against total tax revenue

`data.expenditures` (UBI + one key per govtSpending functional category) is
currently shown as its own mirrored total, not subtracted from
`data.totals`/`drawTotal()`. Decide whether/how a net revenue-minus-spending
figure should be shown.

## data

add more data, show all assumptions, try get more than one source.
may

## Keep data sources seperate. Merged tabs dont need merged data sources.

## People tab

Various defined 'people' with income, assets, expenses, etc. (one for every tax type).
Show persons financial info, name portrait etc. THen below show how much they are paying.

Allow adding custom people as with tax plan

## Comparing different tax settings.

Cannot think of easy way to show clearly. For total tax take bar, could show other settings as marks on the bar.

## Spending settings

Done: an "Expenses" top-level tab now shows government spending by
functional category (health, education, benefits, defence, etc.), each with
its own $/capita or $/recipient rate slider, sourced from Treasury's FSGNZ
Core Crown functional-classification tables - see ASSUMPTIONS.md's "New:
Expenses tab" entry. Still open: every plan currently defaults to the same
current-law rate, since no party has published a costed spending policy -
if/when a party proposes a specific spending change (e.g. a costed benefit
increase or defence spend boost), that plan's `govtSpending` field is where
it'd go.

## Other tax related settings

Add more settings, e.g. exclude fruit and veg from GST.
