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
Expenses tab" entry.

Done: each of the five live `2026 [Proposed - X]` plans in `budget_plans.json`
(renamed from `tax_plans.json`, since it now covers spending policy too) now
carries its party's real costed/estimated spending changes, where any exist -
see ASSUMPTIONS.md's "Costed spending changes per 2026 plan (Aug 2026)"
entry. Still open: most categories for most parties had no findable 2026
commitment and stay at baseline - revisit if/when a party publishes a costed
change for one of those (e.g. National's own 2026 Budget, once its specific
line items are confirmed beyond the current FY2025 baseline).

## Other tax related settings

Add more settings, e.g. exclude fruit and veg from GST.
