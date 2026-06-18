# Vela Pay — Context Documents (v1)

> Four reference documents authored for use as RAG context in the Asterline demo.
> All clause identifiers (SP-x, TG-x, KI-x, RM-x) are used as `source_refs[]` in work packs.
> Synthetic data only — no real company, product, or person represented.

---

## Document 1: Product One-Pager

### What it is
Vela Pay is a B2B platform for cross-border stablecoin payments, built for small and mid-sized businesses (SMEs) that pay or get paid internationally — freelancers' payroll, supplier payments, marketplace payouts, and corporate card spend.

### Who it's for
- SMEs with recurring cross-border payments (e.g. agencies paying overseas contractors, e-commerce sellers paying suppliers abroad)
- Marketplaces/platforms that need to pay out to a global pool of sellers or freelancers
- Finance teams who currently rely on slow bank wires or multiple regional payment providers

### Core value proposition
Move money across borders in stablecoins, settle near-instantly, and avoid the multi-day delays and high FX markups of traditional wire transfers — while giving finance teams a single dashboard for payouts, cards, and reconciliation.

### Core features (v1)

1. **Cross-border payouts**
   - Send USDC/USDT payouts to recipients in 30+ countries
   - Recipient receives local fiat via partner off-ramp, or holds stablecoin in a Vela Pay wallet
   - Batch payouts via CSV upload (e.g. payroll runs, supplier payments)

2. **Corporate cards**
   - Virtual and physical cards issued against a company's stablecoin balance
   - Per-card spending limits and category restrictions, set by admins
   - Real-time transaction notifications

3. **Multi-currency balance & FX**
   - Hold balances in USDC/USDT and major fiat-pegged stablecoins
   - In-app conversion at near-spot rates (small spread disclosed upfront)

4. **Compliance & onboarding**
   - KYB (Know Your Business) onboarding for company accounts
   - KYC for individual payout recipients above a threshold
   - Transaction monitoring for sanctions/AML screening

5. **Dashboard & reconciliation**
   - Unified view of payouts, card spend, and balances
   - Exportable transaction reports (CSV) for accounting reconciliation
   - Basic role-based access (admin / finance / viewer)

### Pricing model (v1, illustrative)
- Free to hold balances and receive payouts
- Flat fee per outbound payout (e.g. $1–3 depending on destination/method)
- Small FX spread on currency conversion (disclosed in-app)
- No monthly subscription fee in v1; card issuance fee waived for first N cards

### Out of scope for v1
- Consumer-facing app (B2B only)
- Credit lines / lending
- Non-USD-pegged stablecoins
- Multi-entity / subsidiary account structures

---

## Document 2: Support Policy

**SP-1.** If a payout fails due to incorrect recipient details provided by the sender, Vela Pay will attempt to reverse the transaction to the sender's balance within 3–5 business days. A reversal fee equal to the original payout fee may apply.

**SP-2.** If a payout fails due to a Vela Pay system or partner error (not caused by incorrect recipient details), the full amount is reversed to the sender's balance within 1 business day, with no fee.

**SP-3.** Stablecoin-to-fiat off-ramp delays caused by the recipient's local banking partner are outside Vela Pay's direct control. Support can escalate but cannot guarantee a resolution timeline; typical resolution is 1–3 business days.

**SP-4.** Cardholders can dispute a transaction within 60 days of the transaction date. Disputes are submitted via the dashboard and reviewed within 5 business days.

**SP-5.** Vela Pay does not reverse card transactions that were authorized by the cardholder, even if the cardholder later regrets the purchase (no "buyer's remorse" reversals).

**SP-6.** Business accounts must complete KYB before sending or receiving payouts exceeding $1,000 in cumulative volume. Below this threshold, a limited-access account is available with reduced limits.

**SP-7.** Individual payout recipients must complete KYC once cumulative receipts exceed $10,000 in a rolling 12-month period. Until then, payouts proceed without additional recipient verification.

**SP-11.** KYB document collection and identity verification must be conducted through Vela Pay's secure document portal or the in-app upload flow. Do not direct customers to submit KYB materials, identity documents, or compliance records via email or other unencrypted channels.

**SP-8.** The FX spread applied at conversion is shown to the user before confirming the transaction. Vela Pay does not retroactively change the spread on a transaction already confirmed.

**SP-9.** Payout fees are charged to the sender. Recipients do not pay a fee to receive funds, regardless of destination country.

**SP-10.** If a company's primary admin account is locked out (e.g. lost 2FA device), account recovery requires manual verification by the support team and may take up to 2 business days.

---

## Document 3: Tone & Voice Guideline

**TG-1. Direct, not corporate.** Avoid filler phrases ("We're sorry for any inconvenience this may have caused," "Thank you for your patience"). State what happened and what happens next.

**TG-2. Precise about money and time.** Never say "soon," "shortly," or "as quickly as possible" when a specific timeframe is known (see Support Policy for standard timeframes). If no timeframe is known, say so explicitly rather than guessing.

**TG-3. No blame-shifting language toward the user.** Avoid phrasing that implies the user made a mistake (e.g. "Unfortunately, you entered the wrong details") — even when SP-1 applies. Instead: "The payout failed because the recipient details didn't match — here's how to fix it."

**TG-4. Plain language over financial jargon.** Avoid terms like "off-ramp," "settlement," "spread" in user-facing copy unless the user used the term first. Prefer "convert to local currency," "transfer completes," "conversion fee."

**TG-5. Acknowledge money/timing concerns first.** When a reply addresses a delayed or failed payment, the first sentence should address the money/timing question directly — not background context or apology.

**TG-6. Confident but not overpromising.** Don't promise outcomes outside Vela Pay's control (e.g. don't promise a partner bank will resolve something by a specific date — see SP-3).

### Examples

❌ "We're sorry for the inconvenience! Your payout is currently being processed and should arrive shortly. Thank you for your patience."

✅ "Your payout failed because the recipient's account details didn't match. Per our policy, the amount will be returned to your balance within 3–5 business days, with a reversal fee of [fee]. You can resend with corrected details once the reversal completes."

---

## Document 4: Known Issues & Roadmap

### Known issues (current)

**KI-1.** Batch payout CSV upload fails silently if the file contains more than 500 rows — no error message is shown, and the upload simply doesn't complete. Workaround: split into batches of ≤500.

**KI-2.** Virtual card transaction notifications are sometimes delayed by 10–15 minutes during high-traffic periods (typically UTC evenings), which can cause confusion about whether a transaction went through.

**KI-3.** The dashboard's exportable CSV report does not currently include the FX spread as a separate line item — it's baked into the total, making reconciliation harder for finance teams that need to track FX costs separately.

**KI-4.** Recipients in a small number of supported countries (currently under review) experience off-ramp delays longer than the typical 1–3 business days referenced in SP-3, sometimes extending to a week, due to partner bank processing times.

### Roadmap (not yet built — frequently requested)

**RM-1.** Multi-entity / subsidiary account structures — requested by larger SME customers managing multiple legal entities under one parent company.

**RM-2.** Scheduled/recurring payouts (e.g. automatic monthly payroll runs without manual re-upload) — currently every payout requires a fresh CSV upload or manual entry.

**RM-3.** Role-based approval workflows (e.g. payouts above a threshold require a second admin's approval before sending) — current v1 only has admin/finance/viewer roles without an approval chain.

**RM-4.** Non-USD-pegged stablecoin support — requested mainly by customers in regions where USD stablecoins face local regulatory friction.
