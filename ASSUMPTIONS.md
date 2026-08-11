# Data assumptions

Gaps and assumptions from the 2026-election data/policy research that couldn't be
resolved from public sources, plus methodology notes and fix history for the
underlying datasets. Recorded here instead of silently guessed — see git
history around this file's introduction (originally part of TODO.md) for the
research that produced them.

## Party positions defaulted to National's baseline (no stated policy found)

- **Trust tax rate**: ACT, NZ First, Greens, and TOP have no stated 2026 position
  on the 39% trustee tax rate. All default to 39% (current law). ACT's broader
  income-tax policy logically implies pressure to align the trustee rate with a
  lower top personal rate (33%), but no source explicitly confirms this — don't
  assume alignment without a citation.
- **Land tax**: ACT and NZ First have no explicit position (opposition can be
  reasonably inferred from ACT's general anti-new-tax stance, but isn't
  documented). Both default to 0%.
- **Wealth tax**: NZ First has no stated position. Defaults to 0%.
- **Fuel excise duty / ETS**: Labour, Greens, NZ First, and TOP have no policy
  specific enough to map to a real cents/litre or $/tonne rate:
  - Greens want structural ETS changes (phase out forestry offsetting, price
    agricultural emissions) but no quantified rate.
  - NZ First's only stated position (from their 2023 platform) is "won't
    support emissions pricing unless adopted by trading partners" — not a rate.
  - ACT wants ETS auction revenue returned as a per-adult dividend
    (~$243/adult in current alt-budget) rather than a rate change — this is a
    revenue-*distribution* policy, not a tax-rate policy, and doesn't fit our
    model at all.
  All of these default to the current real rate (see "Other Indirect Tax and
  ACC Levies now use real rate units" below).
- **National**: no official, campaign-specific 2026 tax policy document was
  found at all (as of the August 2026 research date) — everything attributed
  to National is the *current governing law* (2023–2024 Budget settings), not a
  confirmed 2026 manifesto commitment. Recheck national.org.nz once they
  publish a formal policy document.

## Modelled/estimated data (not independently sourced)

- **`data/cgt_2024.json`/`data/cgt_2025.json`**: no public taxable-capital-gains
  dataset exists. The base is back-calculated from Labour's own steady-state
  CGT revenue projection ($969m at a 28% rate), so it's only as good as
  Labour's costing. If IRD or Treasury ever publishes bright-line-test
  sale/gain statistics, replace this with a real base.
- **`data/land_2024.json`/`data/land_2025.json`**: no consolidated national
  land-value total is publicly indexed (checked QV, LINZ, Stats NZ). The
  urban/rural split is back-derived from TOP's own $24bn/year revenue
  estimate at their stated 1.75%/0.5% rates — TOP's own costing has been
  publicly questioned (NZ Initiative) as not transparently derived, so treat
  this dataset as a rough approximation, not a sourced figure.
- **`data/fbt_2024.json`/`data/fbt_2025.json`**: Treasury publishes FBT
  revenue collected ($838m FY2024, $909m FY2025 - both directly sourced,
  solid figures) but not the underlying taxable base. The base is back-
  calculated by dividing revenue by IRD's current 63.93% single rate - an
  approximation, since some employers use the 49.25% alternate/pooled rate
  instead, meaning the true base is somewhat larger than this implies.
- **Other Indirect Tax and ACC Levies now use real rate units, not an
  abstract 0-100% multiplier** - each slider holds the actual current
  statutory/levy rate (¢/L, $/tonne CO2-e, $/1,000 cigarettes, $/L pure
  alcohol, $/1,000km, $/vehicle, or a genuine %), and each dataset entry's
  `value` is a back-derived taxable BASE (litres, tonnes, cigarettes, km,
  vehicles, or $ turnover) computed as revenue ÷ current rate - see
  `otherindirect_2025.json`'s `source.componentNotes` and
  `nontaxrevenue_2025.json`'s `source.assumptions` for the sourced rate and
  citation behind each one. Several of these rates are themselves
  approximations standing in for a genuinely non-uniform real schedule:
  - **Tobacco Excise** uses the standard-cigarette tier ($1,272.01/1,000
    cigarettes); the heavier >0.8kg/1,000 tier and loose/RYO tobacco (both
    $1,812.61) are ignored.
  - **Alcohol Excise** uses one blended rate (the "beer >2.5% ABV" rate,
    $37.836/L pure alcohol) across both domestic and import components, even
    though beer/wine/spirits/RTDs each have a different real rate.
  - **Road User Charges** uses the standard light-vehicle rate ($76/1,000km)
    across all RUC-liable distance; real heavy-vehicle rates vary
    substantially by weight/axle configuration.
  - **ETS carbon price** (~$62/tonne) is an approximation of an inherently
    volatile secondary-market price, not a legislated rate - most 2025 EPA
    unit auctions failed to clear (zero bids).
  - **ACC Work Levy** ($0.63/$100 payroll) is ACC's own published
    scheme-wide average, standing in for 500+ industry-specific
    Classification Unit rates that actually range $0.02-$5.77/$100 - the
    biggest simplification of the nine.
  - **ACC Motor Vehicle Levy** ($113.94/vehicle/year) is ACC's own
    scheme-wide average across ~10 vehicle classes, not any single class's
    real fee.
  - **Gaming Duty** (20%) and **ACC Earner's Levy** (1.39%) are the only two
    of the nine that are genuinely clean, uniform statutory rates - no
    approximation involved.
  Both years (FY2024/FY2025) are back-derived using the same CURRENT (2025)
  rate, even though tobacco/alcohol excise are actually indexed annually and
  FY2024's true rate was slightly lower - the same single-rate-for-both-years
  simplification already used for cgt/land/fbt.

## Known dataset resolution limits

- **`data/wealth_2024.json`**: Stats NZ's household net worth statistics don't
  publish bands above ~$1.5M net worth. The Green Party's wealth tax threshold
  ($10M individual / $20M couple) is being applied against a top-open bucket,
  which understates precision at the high end — the simulator can't currently
  distinguish a household worth $10M from one worth $500M. IRD's 2023
  "High-Wealth Individuals Research Project" (which studied ~311 wealthy NZ
  families directly) might provide a usable top-end shape if revisited — not
  fetched in this pass.
  - **Follow-up (Aug 2026):** fetched and read the IRD report
    (report-high-wealth-individuals-research-project.pdf, table 15.3, p.117).
    It only gives 3 coarse bands for its ~311-family "Project" population
    (net worth generally >$50m, or >$20m if they control a significant
    business) for 2021: <$50m — 85 families (27%); $50m–$250m — 149 (48%);
    >$250m — 77 (25%). Mean net worth $276m, median $106m. This is a small,
    non-random survey sample (not census data), so it can't be turned into
    population counts the way the Stats NZ bands are used elsewhere in this
    dataset — at best it could sanity-check the *shape* of the tail, not
    supply real counts.
  - This also means there's a **missing-middle gap**: Stats NZ tops out
    around $1.5m and the IRD study starts around $50m (or $20m) — nothing
    public covers net worth between roughly $1.5m–$20m/$50m, which is
    exactly the range that matters for a $10m-threshold wealth tax like the
    Greens'. Didn't find a Stats NZ table that resolves this either — their
    net worth release (`Household net worth statistics`, DataInfo+ item
    f98d411f-4903-477a-b7ce-ffc70e85b378) links to per-survey-year pages
    (2017/18, 2020/21, 2023/24) whose actual band-boundary tables are on
    NZ.Stat / downloadable CSVs, not the HTML info pages — those weren't
    reachable through fetch tools in this pass (JS-rendered navigation) and
    would need a direct NZ.Stat query or manual download to confirm whether
    they resolve any finer than the ~$1.5m ceiling already assumed here.
- **`data/trust_2024.json`**: IRD's trustee income data is aggregate-only (no
  per-band distribution exists publicly), and the most recent published year
  (tax year to 31 March 2024) predates the 39% trustee rate taking effect
  (1 April 2024) — so this is a *pre-rate-change* base being taxed at the
  *post-change* rate, not an apples-to-apples actual.
- **Green Party wealth tax couple threshold** ($20M for couples vs $10M
  individual) isn't modelled — the simulator only has a single threshold
  field, so all plans use the individual figure.
- **`data/<year>/general.json`'s `adultPopulation`** uses Stats NZ's HLFS
  working-age population (15+) as the UBI recipient count - slightly
  overstates true 18+ adults (includes 15-17 year olds) and doesn't exclude
  the small institutionalised population. No simple NZ 18+ headline figure
  was found; revisit if one turns up.

## The stacked total now includes non-tax Crown revenue by design

`drawTotal()` sums every key in `data.totals` - ACC levies and
`nonTaxRevenue` (SOE dividends/profits, investment income, sale of goods and
services, fees/fines, royalties) are included alongside actual tax
categories, even though Treasury's own accounts book them separately from
tax. This was a deliberate choice (all Crown revenue counts, not just tax),
not an oversight - see `main.js`'s comment above `drawTotal()`.

`data/nontaxrevenue_2024.json`/`data/nontaxrevenue_2025.json` - unlike every
other category, non-tax revenue has no policy rate to apply and doesn't vary
by tax plan, so it skips `budget_plans.json` and `createNewIncomePlan()`
entirely. Now sourced from Treasury's FSGNZ Notes 4-7, but several lines are
proxies rather than exact matches to their label (FSGNZ fully consolidates
SOEs, so there's no standalone "SOE dividends" line - "SOE dividends and
profits" here uses the general Crown "Dividends" figure instead; see each
file's `assumptions` for the specific substitutions). "Petroleum and mineral
royalties" is still 0/unsourced - Treasury's generic "Sale of royalties"
line isn't petroleum-specific, and MBIE/NZPAM's own petroleum figures
weren't available on a consistent basis across both years.

## FBT, Other Indirect Tax, and ACC Levies are now sourced (FY2024/FY2025)

All three now use real Treasury/ACC figures instead of the 0 placeholders
they launched with - see each dataset file's `assumptions` field for exact
line-item citations. `budget_plans.json` defaults FBT to the current 63.93%
single rate and every Other Indirect Tax/ACC component to its own current
real rate (see "Other Indirect Tax and ACC Levies now use real rate units"
above) for every plan, matching how undecided-party positions elsewhere
already default to current law.

## `otherTaxBaseline` had a real bug, now fixed and year-aware

Sourcing Other Indirect Tax's real figures surfaced that the original
`otherTaxBaseline` constant (`7279000 - (2002000 + 1690000)`) was wrong, not
just imprecise: $7,279,000 was Treasury's **cash-receipts** "Other Indirect
Taxation" total, but the $2,002,000 being subtracted from it was that same
year's **accrual** fuel-excise figure - two different tables. Worse, the
$1,690,000 (ETS) subtraction was never valid at all: Emission Trading
revenue sits under Treasury's "Other Sovereign Revenue" section, not "Other
Indirect Taxation" - it was never part of the $7,279,000 to begin with, so
subtracting it was silently under-counting `other` by that whole amount.

Now fixed as `otherIndirectResidual` (`main.js`): the accrual "Other Indirect
Taxation" total (FY2024 $7,387m, FY2025 $7,656m) minus fuel excise minus the
four Other Indirect Tax components (tobacco/alcohol/RUC/gaming), leaving
just the genuinely-unmodeled remainder (Other customs duty, Motor vehicle
fees, Approved issuer levy and cheque duty, Energy resources levies -
$582,000 FY2024 / $606,000 FY2025). This also fixes the old "doesn't flex
with the year selector" limitation, since both years are now known and
`recalculateAll()` updates `data.totals.other` on every year switch.

## More sources - done

Every dataset file's top-level `source` object is now a `sources` array
(`main.js`'s `drawAssumptions` renders one paragraph per entry). Every file
currently has exactly one entry - the schema now supports adding a second
corroborating source with its own `date`/`url`/`name`/`assumptions` per data
type, next time one's found.

## Corroboration pass (Aug 2026) - fixes, back-derivations, and new features

Went back over every dataset's assumptions against live sources, then acted on
what was found: fixed a genuine data error, re-derived several taxable bases
against newer real rates/sources, and added two new modelling features. Detail
folded into the relevant JSON files' `assumptions`; summary here.

**Fixed:** ACT's 2026 income tax brackets were simply wrong - `budget_plans.json`
had 30%/33%, but ACT's actual policy is 17.5% to $70K then 28% above (aligning
the top rate with the 28% company rate). The cited link was also wrong (a 2022
press release about the bright-line test, not this policy). Both corrected.

**New: Greens' large-company corporate tax slider.** Greens' 2026 policy also
raises corporate tax to 33% for companies with turnover >$30M (~0.7% of
businesses) while leaving everyone else at 28% - added as a second `corpLarge`
slug/slider in `corp.json`/`main.js`, alongside the existing flat `corp` one.
Its taxable base (~$29.5bn) is back-derived from Greens' own costing
(~$1.475bn/yr, cross-confirmed by Deloitte's independent estimate), the same
technique this project already uses for cgt/land/wealth - no IRD/Stats NZ
company-tax-by-turnover-band split exists publicly to check it against.

**Fixed a real pre-existing bug:** `data/2025/corp.json` was storing raw
FSGNZ 2025 revenue figures directly instead of revenue/rate like every other
file (2024's corp.json included) - confirmed by fetching FSGNZ 2025 p.65
directly and comparing literal $m figures against both files. This meant the
app's generic take=value*rate/100 formula was understating FY2025 corporate
tax ~3.5x at the default 28% rate. Corrected, all now genuine revenue/rate
bases: corp 63,310,714 (was 17,727,000), refunds -3,442,857 (was -964,000),
nrwt 4,886,667 (was 733,000), rwt-interest 10,809,091 (was 3,567,000),
rwt-dividends 2,848,485 (was 940,000). Also surfaced a real finding along the
way: RWT on dividends genuinely fell from $2,521m (FY2024) to $940m (FY2025)
per Treasury - a real year-on-year swing, not a data error.

**New: "Exempt light EVs from RUC" checkbox.** Initially assumed the light-EV
RUC exemption ended in 2026 (based on a bad source) - corrected: it actually
ended **1 April 2024**, so the existing FY2024/FY2025 RUC-liable-distance data
already includes (most of) EV distance. The checkbox does the opposite of
what was first planned: unchecked (default) matches current law; checking it
simulates the pre-Apr-2024 exempt policy by subtracting an estimated EV
distance (~1.15bn km/yr, low-confidence - see `EV_RUC_KM_ESTIMATE` in
main.js) from the RUC base.

**Fuel tax/RUC reform - considered, not modelled.** Two live reforms could
change this tab's structure further: (1) a legislated 12c/L fuel excise rise
for Jan 2027 looks likely to be deferred/scrapped (Willis, reported Mar-May
2026); (2) government is progressing full transition of ALL light vehicles
(incl. petrol) from fuel excise to electronic RUC (Land Transport (Time of Use
Charging) Amendment Bill, targeting "open for business" 2027) - if enacted,
this would eventually make the fuelExcise/roadUserCharges split obsolete
(everyone pays RUC, no one pays fuel excise). Neither has a confirmed
date/mechanism yet, so neither is modelled - revisit once (2) passes.

**Back-derived to current rates (Aug 2026):** tobacco excise base re-derived
at $1,309.71/1,000 cigarettes (was $1,272.01), alcohol excise at $38.999/L
pure alcohol (was $37.836), ETS at ~$55.13/tonne (was ~$62), ACC levies at the
2026/27 rates - Earner's Levy $1.75/$100 (was $1.39), Work Levy $0.69/$100
(was $0.63), Motor Vehicle Levy $131.94/vehicle (was $113.94). Fuel excise
(70.024c/L), RUC ($76/1,000km) and gaming duty (20%) unchanged, so unaffected.
`budget_plans.json`'s shared default rates updated to match.

**Applied:** `land.json`'s urban/rural totals now start from Stats NZ's real
published non-produced-assets ("land") total ($1.713 trillion at 31 Mar 2022,
minus $86.4bn government land = $1.627 trillion taxable) instead of being
entirely back-derived from TOP's own costing - though the urban/rural *split*
of that total is still TOP's unsourced 85/15 assumption, since Stats NZ's
table only splits by institutional sector, not urban/rural. No 2023/2024
vintage of that table was found, so both years use the same 2022 figure.
`nontaxrevenue.json`'s `petroleumRoyalties` is now $107.7m (FY2025)/$201.5m
(FY2024) instead of 0 - derived by subtracting Treasury's separately-booked
"Energy resources levies" from NZPAM's combined royalties+levies figure, not
an official isolated split.

**Confirmed still-open (not just unsearched):** National has no 2026 campaign
tax policy document as of today; ACT/NZ First/Greens/TOP still have no stated
2026 trustee-tax position; ACT/NZ First still have no land-tax position;
NZ First still has no wealth-tax position. NZ First's income-tax link is
confirmed dated 2023 (no 2026 restatement found).

**Cross-checks that held up:** wealth.json's band totals sum to ~$2.068
trillion, matching Stats NZ's independently published $2.067 trillion total
household net worth almost exactly. IRD's trustee-income aggregate is
confirmed still the most recent published figure (no 2025 update exists).
Labour's CGT is confirmed as their own costing but is narrower than modelled -
property-only (not general capital gains) and effective 1 Jul 2027, not
immediate. FBT revenue has an unresolved ~$13m gap vs. Figure.NZ's IRD-sourced
figure for the same tax year (possibly a March vs June year-end mismatch).

## corp/corpLarge double-count, fixed

`corpLarge`'s ~$29.5bn taxable-income base (companies >$30M turnover, for the
Greens' proposed 33% rate) was never subtracted out of `corp`'s Gross
Corporate figure, which covers ALL companies - large companies' income was
being taxed twice. Fixed by subtracting corpLarge's base from corp's Gross
Corporate in both years' `corp.json` (2025: 63,310,714 -> 33,810,714; 2024:
60,500,000 -> 31,000,000), so the two components now sum back to the real
FY total. Refunds aren't split by company size (no data exists to do so) and
stay entirely under `corp`.

## General capital gains tax - found data, not modelled as a slider

The 2018/19 Tax Working Group (Cullen report) modelled a much broader,
realisation-based CGT than Labour's 2026 property-only policy - covering
land (except the family home), shares, and business assets - with revenue
projected to rise from $0.4bn (2021/22) to $5.9bn (2030/31), reaching 1.2%
of GDP by year 10 (final report, Table 5.2). Not built as a slider here:
the TWG taxed gains at each taxpayer's own marginal income tax rate, not
one flat rate, so there's no single rate to back-derive a taxable base
against without inventing one the TWG never used. No 2026 party proposes a
CGT this broad. Documented as a source on `otherdirect.json`'s CGT entry
instead. If ever modelled properly, it would need a marginal-rate-weighted
approach this project's flat-rate slug design doesn't currently support.

## Other Tax Working Group-costed mechanisms

Skimmed the TWG's 2019 final report for other tax types with enough
quantitative detail to plausibly become a data file.

**Added, with real costings:**

- **Waste Disposal Levy** - a real, currently-existing NZ tax (Waste
  Minimisation Act 2008), not itself a TWG proposal; the TWG report just
  noted then-current revenue and modelling (Eunomia) for a higher rate. Now
  a new `wasteLevy` component in `otherindirect.json`/`main.js`, using the
  current Class 1 (municipal) rate ($70/tonne, staged up to $75/tonne by
  2027) as a blended representative rate, with a taxable base back-derived
  from a Beehive revenue projection (~$257m/year fully phased in) rather
  than a confirmed FY2024/FY2025 actual - no outturn figure or full
  per-class tonnage breakdown was found, so this is a rough approximation.
- **Nitrate leaching charge** - the TWG's own hypothetical $2/kg-of-nitrogen
  charge, estimated to raise ~$270m/year. Not an enacted tax and no 2026
  party proposes it, so it's a new `nitrateTax` component defaulting to $0
  in every plan - moving its slider shows what the TWG's own proposal would
  raise. Its ~135,000-tonne taxable base is the TWG's own implied figure
  (revenue/rate), not an independently measured national total.

**Already covered, not a new candidate:**

- **ETS unit auctioning** - the TWG's scenario revenue ($130m-$830m/year,
  2021-30 average, Table 4.1) is for the same auctioning mechanism this
  project's `ets` slug already models (NZ already auctions NZUs today) -
  not a distinct additional tax to add.

**Qualitative-only or wrong shape - not implementable:**

Water abstraction tax, road congestion pricing, a financial transactions
tax, GST on financial services, and retirement-savings tax changes are all
qualitative-only in the TWG report - no source has published a revenue
figure for any of them. Reinstating building depreciation is a tax *cost*
(up to $1.46bn/5yr, Table 6.1), not revenue, so it doesn't fit this
project's revenue-modelling shape either.

## General CGT taxed at marginal rate - data gap, not a design gap

Asked whether a CGT tab could use the same bracket-ladder plot as income
tax and wealth tax (taxing gains progressively at each taxpayer's own
marginal rate, rather than one flat rate). The UI pattern would work fine -
`bracketConfig` is already generic. The blocker is data, not design: NZ has
no dataset of capital gains by income band or marginal bracket. The TWG's
own distributional-analysis background paper says so explicitly ("there is
no available data on capital gains at individual or household level in New
Zealand") and falls back to an illustrative proxy instead - a flat 3%/year
nominal gain applied uniformly across Stats NZ's household net-worth
deciles (HES 2015), taxed at an assumed flat 30% effective rate for the
illustration, not real marginal rates. No later NZ or overseas source fills
this gap with a real distribution. Building this tab would mean choosing
and clearly flagging a proxy distribution (most defensibly, replicating the
TWG's own net-worth-decile approach against `wealth.json`) rather than
sourcing real data - a bigger step than everything else in this project,
which back-derives *totals* from real costings but doesn't yet fabricate a
*distribution*. Worth doing if wanted, but flagging the difference before
building it.

## New: Expenses tab (government spending by functional category)

`data/2024/expenditure.json`/`data/2025/expenditure.json` model government
spending using the same shape as `otherIndirect.json`/`nonTaxRevenue.json`'s
real-rate components: each entry's `value` is a real taxable-equivalent
*base* (population, or a benefit's recipient count - NOT a placeholder), and
the actual dollar amount is base × rate, where the rate ($/capita/year or
$/year/recipient) lives in `budget_plans.json`'s new `govtSpending` field per
plan, same as e.g. `otherIndirect.tobaccoExcise`. `main.js` wires this in as
a fourth `multiComponentConfig` entry (`govtSpending`) - identical shape to
corp/land/otherDirect/otherIndirect/nonTaxRevenue, generalized to write into
`data.expenditures` instead of `data.totals` via a new `totalsBucket` option
on the config, so government spending stacks separately from tax revenue on
the drawer's Total tab rather than being summed into it. Unlike every other
multi-component category (which collapses its many slugs into one lump
total), `govtSpending` also sets `perCategoryTotals: true`, so the drawer's
Expenditure bar shows one segment per functional category (Health,
Education, NZ Superannuation, ...) rather than one "govtSpending" lump sum -
deliberately more granular than the Revenue bar's per-tax-type segments,
since seeing the spending breakdown by category is the point of this tab.

**Rates sourced (Aug 2026):** the 13 previously-unrated categories (health,
education, coreGovernmentServices, lawAndOrder, defence, transport,
housingCommunity, economicIndustrial, primaryServices,
heritageCultureRecreation, environmentalProtection, gsfPensions,
otherExpenses) plus welfareResidual now have real default rates, back-derived
from Treasury's FSGNZ B.11 "Fiscal Indicator Analysis - Expenses by
Functional Classification" Core Crown table (FY2025 report p.160, FY2024
report p.170 - both fetched directly and cross-read with `pdftotext`, not
search-summarised). All 13 categories + the welfare total + Finance Costs
reconcile to the published Core Crown total *to the dollar* for both years
($138,998m FY2024, $141,675m FY2025) - no forced rounding needed. At launch,
every plan in `budget_plans.json` got the identical current-law rate (no
party's costed spending policy had been researched yet) - see "Costed
spending changes per 2026 plan (Aug 2026)" below for where that stood.

## Costed spending changes per 2026 plan (Aug 2026)

Closed the gap above: researched each of the five live `2026 [Proposed - X]`
plans' actual party platforms for quantified spending commitments, one
bounded research pass per party (a handful of searches, not an exhaustive
per-category dig - most parties only cost a few flagship items). Renamed
`tax_plans.json` → `budget_plans.json` at the same time, since the file now
covers spending policy as well as tax.

**Found and applied**, converted into this app's $/capita or $/recipient
units:

- **Labour**: `health` +$104/capita (Medicard - free GP visits, prescriptions,
  cervical screening, maternity scans - costed by Labour at $393.3m/yr rising
  to ~$553m/yr by 2028/29) and `transport` +$12/capita (the $20/$10 weekly
  fare cap, Labour's own $65m/yr costing, though the Taxpayers Union disputes
  this at $141-182m).
- **Greens**: `jobseeker` → $20,540/yr (the "Income Guarantee" $395/week
  floor replacing Jobseeker Support - a stated floor, not necessarily above
  this app's modelled recipient average) and `soleParent` → $31,980/yr (the
  same policy's family top-up, one-child case). `supportedLiving` →
  $39,100/yr is flagged lower-confidence - sourced only from secondary
  commentary (not greens.org.nz directly) describing an ACC-replacement
  disability agency guaranteeing 80% of minimum wage.
- **ACT**: `coreGovernmentServices` → $1,340/capita, a rough ~10% estimate
  (ACT published no dollar figure) for their pledge to collapse 43 government
  departments into 19 and 28 ministers into 18, explicitly excluding
  frontline nurses/teachers/police.
- **NZ First**: `health` +$82/capita, `lawAndOrder` +$41/capita, `defence` →
  $1,623/capita (their 2%-of-GDP-by-2030 target expressed as an absolute
  rate, not an addition to baseline), and `economicIndustrial` +$63/capita
  are light estimates annualized from quantified-but-uncosted pledges (a
  $1.3bn Pharmac ask, 500 police + 1,000 corrections places, a $1bn
  subsurface oil/gas survey). `otherBenefits` +$91/capita is the one
  genuinely party-costed figure (the SuperGold rates-rebate, ~$480m total).
- **TOP**: `jobseeker` → $19,400/yr (the flat Citizen's Income replacing
  targeted Jobseeker Support) and `transport` +$70/capita (a rough estimate
  of forgone fare revenue for TOP's uncosted permanent-free-public-transport
  pledge). `nzSuper` stays at $27,988 - not unresearched, but confirmed held
  flat by design (TOP guarantees no one on NZ Super receives less than now).

**Everything else, for all five parties, is left at the FY2025 baseline** -
no quantified 2026 commitment was found after a bounded search, which is
itself the expected finding (most parties only cost a handful of flagship
promises, not all 19 functional categories) rather than a research failure.
The three historical income-tax snapshots (`2010 [National]`,
`2021 [Labour]`, `2023 [Proposed - Greens]`) were deliberately left
unresearched - they exist to compare past income-tax settings, not as
spending platforms.

**Recording sources - rethought for accessibility.** Per-category citations
(up to 95 party×category combinations) would have been far too dense to be
useful, in the JSON or in the UI. Instead each plan that got real research
carries a small `sources` array - same `{date, url, name, assumptions}` shape
already used by every dataset file, 1-2 entries per plan - with one prose
paragraph per source stating which categories are sourced-costed vs.
estimated vs. left at baseline, mentioning the actual figures (matching how
dataset `assumptions` paragraphs already read). `main.js`'s
`drawPlanAssumptions()` renders the current plan's `sources` into a single
box near the top of the Expenses tab (`#budget-plan-assumptions`) - once per
plan, not once per category. Considered and rejected splitting these into a
separate sources file: every dataset file already co-locates values and
sources in one JSON, and there's no build step in this project to keep two
files in sync by hand, so `budget_plans.json` keeps its own. Editing any
`govtSpending` slider clones the plan into a sourceless "Custom Plan" (same
copy-on-write pattern as everything else - see `createNewIncomePlan()`), and
the sources box correctly goes blank at that point, since a hand-edited plan
no longer matches the party's actual sourced position.

**Known gap, by design, not a bug:** the Expenses tab's total reads about
$3.04bn under the official $141,675m Core Crown figure. This is Working for
Families ($3,043m) - deliberately excluded from `welfareResidual` (see
"General capital gains tax"-style precedent above: WFF is subtracted out of
the welfare gap so it isn't double-counted) because this project's
convention is that tax credits/exemptions belong under the tax they offset,
not under expenditure - WFF is intended to eventually be modelled as a
credit against income tax revenue, which isn't wired up yet. Until that
happens, the Expenses tab's total legitimately under-counts real Core Crown
spending by WFF's amount.

**Not modelled:** `financeCosts` has no rate slider (Crown debt-interest
cost isn't a policy lever any party sets directly) - it's a fixed 100%
pass-through, same pattern as non-tax revenue's unrated slugs.
