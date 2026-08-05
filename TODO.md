# TODO

Gaps and assumptions from the 2026-election data/policy research that couldn't be
resolved from public sources. Recorded here instead of silently guessed — see
git history around this file's introduction for the research that produced them.

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
  specific enough to map to our simple 0–100% rate-multiplier model:
  - Greens want structural ETS changes (phase out forestry offsetting, price
    agricultural emissions) but no quantified rate.
  - NZ First's only stated position (from their 2023 platform) is "won't
    support emissions pricing unless adopted by trading partners" — not a rate.
  - ACT wants ETS auction revenue returned as a per-adult dividend
    (~$243/adult in current alt-budget) rather than a rate change — this is a
    revenue-*distribution* policy, not a tax-rate policy, and doesn't fit our
    model at all.
  All of these default to the current baseline (100%).
- **National**: no official, campaign-specific 2026 tax policy document was
  found at all (as of the August 2026 research date) — everything attributed
  to National is the *current governing law* (2023–2024 Budget settings), not a
  confirmed 2026 manifesto commitment. Recheck national.org.nz once they
  publish a formal policy document.

## Modelled/estimated data (not independently sourced)

- **`data/cgt_estimate.json`**: no public taxable-capital-gains dataset exists.
  The base is back-calculated from Labour's own steady-state CGT revenue
  projection ($969m at a 28% rate), so it's only as good as Labour's costing.
  If IRD or Treasury ever publishes bright-line-test sale/gain statistics,
  replace this with a real base.
- **`data/land_estimate.json`**: no consolidated national land-value total is
  publicly indexed (checked QV, LINZ, Stats NZ). The urban/rural split is
  back-derived from TOP's own $24bn/year revenue estimate at their stated
  1.75%/0.5% rates — TOP's own costing has been publicly questioned (NZ
  Initiative) as not transparently derived, so treat this dataset as a rough
  approximation, not a sourced figure.
- **Fuel excise & ETS tabs**: modelled as a single 0–100% multiplier on current
  total revenue, not actual cents/litre + litres-sold or $/tonne +
  tonnes-covered. Real excise/carbon pricing don't scale linearly with a
  simple percentage — this is a simplification for the toy, not a policy
  model. Anyone wanting cent/tonne-level realism should redo this with real
  volume data (NZTA fuel sales, EPA/MfE emissions unit data).

## Known dataset resolution limits

- **`data/wealth_2024.json`**: Stats NZ's household net worth statistics don't
  publish bands above ~$1.5M net worth. The Green Party's wealth tax threshold
  ($10M individual / $20M couple) is being applied against a top-open bucket,
  which understates precision at the high end — the simulator can't currently
  distinguish a household worth $10M from one worth $500M. IRD's 2023
  "High-Wealth Individuals Research Project" (which studied ~311 wealthy NZ
  families directly) might provide a usable top-end shape if revisited — not
  fetched in this pass.
- **`data/trust_2024.json`**: IRD's trustee income data is aggregate-only (no
  per-band distribution exists publicly), and the most recent published year
  (tax year to 31 March 2024) predates the 39% trustee rate taking effect
  (1 April 2024) — so this is a *pre-rate-change* base being taxed at the
  *post-change* rate, not an apples-to-apples actual.
- **Green Party wealth tax couple threshold** ($20M for couples vs $10M
  individual) isn't modelled — the simulator only has a single threshold
  field, so all plans use the individual figure.
- **`data/wealth_2024.json`'s top band is synthetic**: Stats NZ's real quintile
  data doesn't resolve above ~$1.5M net worth, so the top quintile was split
  into an ordinary band and a separate "ultra-wealthy" band whose count/average
  was back-calculated to reproduce the Green Party's own $3.8bn revenue
  estimate at their proposed $10M/2.5% policy — not sourced independently.
  Without this, the wealth tax tab would show $0 for every real 2026 policy,
  since no genuinely public NZ dataset currently resolves the >$10M band.
- **`data/corp_2024.json`'s "Gross Corporate" figure (60,500,000) looks too
  high.** An independent pull of Treasury's FY2024 comparative figures (via
  the FY2025 financial statements) puts gross company tax at ~16,940,000 ($K)
  for the same year — roughly 3.5x smaller. Worth auditing whether the
  original figure used a different accounting basis (e.g. gross assessed
  income tax before square-up) or was a data entry error, before trusting
  income-tax-vs-corp-tax comparisons across the 2024/2025 year selector.
