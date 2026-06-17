# Asterline — Work Packs

## CLU-001 — Batch CSV upload silently fails above 500-row limit with no error feedback
- intent_type: actionable_bug
- dimension: Engineering (3)
- signal_strength: High
- confidence: High
- cluster_members: FB-01, FB-26, FB-27

**Problem brief:** Multiple customers have reported that uploading batch payout CSV files exceeding 500 rows causes the platform to hang indefinitely, displaying no error message, no confirmation, and no indication of whether payments were processed. This is a known issue (KI-1) that has been reproduced across at least three separate tickets involving files of 540, 620, and 700 rows. Affected users have been forced to manually split their files into smaller batches, with one team reporting approximately one hour of additional ops work on a time-sensitive payroll run. The silent failure mode is the primary harm: customers cannot distinguish between a processing delay and a complete failure, creating risk that payments may be believed sent when they were not.

**Key quotes:**
> no error, no confirmation, page just sat there for 10+ minutes
> We had no way of knowing whether the payments had gone out.

**Source refs:** KI-1

**Tasks:**
- [High] Implement a user-facing error message that fires immediately when a CSV upload exceeds the 500-row limit, clearly stating the limit and instructing users to split their file. The error must appear before any processing attempt, not after a timeout. (assignee: Engineering, deadline: None)
  Acceptance criteria: Uploading a CSV with 501 or more rows displays an explicit error message (visible on the upload UI, not just in logs) within 2 seconds of submission, stating the 500-row limit and providing a retry path. No silent hang occurs. Verified via manual QA with files of 501, 600, and 700 rows.
- [High] Add a server-side validation guard that prevents batch uploads above 500 rows from being queued or partially processed, ensuring the silent-completion failure mode cannot occur even if the front-end error is bypassed (e.g. via API). (assignee: Engineering, deadline: None)
  Acceptance criteria: API and UI batch upload endpoints both return a 4xx error with a structured message when row count exceeds 500. No partial processing occurs for over-limit files. Confirmed via integration tests against the upload endpoint.
- [Medium] Update the in-app CSV upload documentation and any onboarding tooltips to prominently state the 500-row limit per batch, and add an indicator in the UI showing row count as a file is selected. (assignee: Product, deadline: None)
  Acceptance criteria: The upload UI displays the current file's row count and the 500-row limit before the user submits. Help text referencing the limit is present on the upload screen. Confirmed via design review and QA.
- [Medium] Evaluate raising the batch row limit above 500 as a medium-term improvement, given that multiple high-volume customers (payroll, supplier payments) regularly exceed it. Produce a scoping estimate for engineering effort and any partner/infrastructure constraints. (assignee: Product, deadline: None)
  Acceptance criteria: A written scoping note exists that documents the feasibility, estimated effort, and any blockers to raising the limit, and is shared with the roadmap backlog. No implementation required at this stage.
- [High] Reply to all three affected tickets (Ticket #58213, Ticket #60102, and the unnamed supplier payment ticket) with the current workaround (split into batches of ≤500 rows) and confirm that a fix for the silent failure is in progress. (assignee: Support Operations, deadline: None)
  Acceptance criteria: All three tickets have a sent customer reply acknowledging the issue, confirming the 500-row workaround, and noting that an error-message fix is being worked on. Replies are logged in the ticketing system.

**Reply draft:**
> Your batch did not complete because there is a current limit of 500 rows per CSV upload — files above that size do not process and do not show an error message, which is the platform's fault, not yours. Splitting the file into batches of 500 or fewer rows is the working fix right now, as you found.

We are actively working on two things: first, adding a clear error message so this never hangs silently again; second, reviewing whether the 500-row ceiling itself should be raised. We do not have a confirmed release date for either change yet and will not guess at one, but both are logged as active engineering items.

If you have upcoming payroll or supplier payment runs before the fix ships, splitting at ≤500 rows per file will work reliably. If you want, we can flag your account so you receive direct notification when the fix is live.

**Review flags:**
- needs_human_review: The reply implicitly asserts that no payments went out during the failed uploads across all three tickets. This is the most likely scenario given KI-1's known behaviour, but it has not been individually verified per account. For Ticket #58213 and Ticket #60102 the users confirmed retransmission succeeded after splitting, which suggests the original did not process — but the unnamed supplier payment ticket (FB-27) only states the user 'cancelled and resubmitted,' and it is not confirmed at the system level that no duplicate or partial batch was queued. A human agent should verify payment state in the platform ledger for each ticket before sending, to avoid a situation where one customer's payments did partially process and the reply incorrectly implies they did not. (blocks: reply_draft)

---

## CLU-002 — Pre-confirmation payout amount doesn't match actual debit — undisclosed $12.40 charge
- intent_type: actionable_bug
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-02

**Problem brief:** A customer reports that the dashboard displayed a payout of $5,000.00 before confirmation, but their bank statement shows a debit of $5,012.40, with the $12.40 difference not itemized anywhere on the platform. The discrepancy appears to be an undisclosed FX conversion fee (referred to in context as a 'spread'), which per SP-8 must be shown to the user before they confirm the transaction. This constitutes a potential policy breach: either the FX spread was not surfaced pre-confirmation as required, or there is an unidentified charge with no visible line item. The issue may also be related to KI-3, which notes that the exportable CSV report does not include the FX spread as a separate line item, suggesting a broader pattern of FX cost visibility gaps in the product.

**Key quotes:**
> The extra $12.40 isn't itemized anywhere — is this an FX adjustment?
> it should be shown before we confirm, not discovered afterward

**Source refs:** SP-8, KI-3

**Tasks:**
- [High] Investigate Ticket #58301 to determine whether the $12.40 difference between the displayed pre-confirmation amount ($5,000.00) and the actual debit ($5,012.40) represents an FX spread, a fee, or an unidentified charge — and confirm whether the charge was or was not displayed to the user prior to confirmation as required by SP-8. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Root cause of the $12.40 discrepancy is identified and documented; it is confirmed whether SP-8 was violated (i.e. the amount was not shown pre-confirmation); findings are logged against Ticket #58301 and shared with Product and Engineering.
- [High] Audit the pre-confirmation flow in the dashboard to verify that the FX conversion fee (spread) is correctly calculated, displayed as a separate line item, and reflected in the total shown before the user confirms — reproducing the condition under which Ticket #58301's discrepancy occurred. (assignee: Engineering, deadline: None)
  Acceptance criteria: The pre-confirmation screen is verified to always show: (1) base payout amount, (2) FX conversion fee as a separate itemized line, and (3) total debit matching what will actually be charged. If a bug is found where the spread is omitted or miscalculated in the displayed total, a fix is scoped and a ticket is filed with severity and timeline.
- [Medium] Assess whether the FX spread itemization gap documented in KI-3 (spread baked into CSV export totals rather than shown as a separate line) is related to or symptomatic of the same underlying issue causing the pre-confirmation display discrepancy reported in Ticket #58301, and update the KI-3 scope if applicable. (assignee: Product, deadline: None)
  Acceptance criteria: A written assessment confirms whether KI-3 and Ticket #58301 share a root cause; if yes, the KI-3 known issue entry is updated to reflect the broader scope (including pre-confirmation display), and a prioritization decision is documented.

**Reply draft:**
> The $12.40 difference between the amount shown on your dashboard and the amount debited from your bank needs to be looked into — we want to confirm exactly what that charge is and whether it was displayed to you before you confirmed.

Our policy is that any conversion fee is shown upfront before you confirm a transaction (SP-8), so if that didn't happen here, that's something we need to fix. We're reviewing your transaction now to identify the source of the $12.40 and confirm whether it was itemized correctly at the point of confirmation.

We'll follow up with a full breakdown of the charge once our investigation is complete. If it turns out the fee wasn't shown to you before confirmation, we'll let you know what remediation applies.

**Review flags:**
- needs_human_review: The reply acknowledges a potential SP-8 policy breach (FX spread not shown pre-confirmation) and references a specific unreconciled money amount ($12.40). A human agent must verify the transaction record for Ticket #58301 before sending — specifically: (1) confirm what the $12.40 charge actually is, (2) confirm whether it was or was not displayed pre-confirmation, and (3) confirm whether any remediation (e.g. refund) is owed before the reply commits to an investigation-only posture. (blocks: reply_draft)

---

## CLU-003 — Webhook and API notifications for real-time payout status updates
- intent_type: feature_request
- dimension: Engineering (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-03

**Problem brief:** A customer has requested programmatic payout status notifications — specifically webhooks or an API polling endpoint — that fire when a payout transitions between states (pending, sent, completed, failed). Without this, their internal systems must poll the dashboard manually, creating integration friction and operational overhead. This capability is not present in the current v1 product, which offers only a dashboard UI and CSV exports. No roadmap item directly matches this request, though it is closely adjacent to the automation gap addressed by RM-2.

**Key quotes:**
> webhook (or API polling endpoint) when a payout moves between statuses (pending/sent/completed/failed)
> update our internal systems automatically instead of checking the dashboard manually

**Source refs:** RM-2

**Tasks:**
- [Medium] Log and formally triage the webhook/API payout status notification request against the existing product backlog; determine whether this should be scoped as a standalone feature or bundled with the RM-2 scheduled/recurring payouts initiative (assignee: Product, deadline: None)
  Acceptance criteria: Request is recorded in the backlog with a documented scoping decision (standalone vs. bundled with RM-2) and an owner assigned; customer is associated with the feature request for future comms
- [Medium] Conduct a discovery spike to define technical requirements for a payout status webhook system: event schema (pending/sent/completed/failed), delivery guarantees, retry logic, authentication model, and API polling alternative (assignee: Engineering, deadline: None)
  Acceptance criteria: A written technical spec or RFC covering event schema, at-least-once delivery semantics, retry/backoff behavior, HMAC or equivalent signature verification, and a comparison of webhook-push vs. polling-pull trade-offs is reviewed and signed off by Product and Engineering leads
- [Low] Assess demand signal for webhook/API payout status notifications across the customer base to inform prioritization; identify other accounts with similar integration needs (assignee: Product, deadline: None)
  Acceptance criteria: A demand summary is produced listing the number of accounts that have requested programmatic payout status access (via support tickets, sales calls, or NPS responses), with a recommended priority tier based on revenue impact and integration complexity

**Reply draft:**
> Thanks for the detailed request — this gives us exactly what we need to evaluate it properly.

Webhook or API-based payout status notifications aren't available in the current version of Vela Pay. Right now, payout status is visible in the dashboard and in the exportable transaction reports, but there's no programmatic event stream to trigger updates in external systems.

We've logged your request with the specific status transitions you outlined (pending → sent → completed → failed) and flagged it for our product team. I can't give you a delivery timeline right now, but I'll make sure you're contacted directly when this moves onto the active roadmap or when we have more to share.

If it's useful in the interim, the transaction report CSV export is available on demand from the dashboard — not a real-time feed, but it may help with periodic reconciliation while we work toward a proper integration option.

---

## CLU-004 — Mobile app session expiry forces repeated full login and 2FA
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-04

**Problem brief:** A user reports that the Vela Pay mobile app terminates their session every few days, requiring them to complete the full login and two-factor authentication flow each time. The frequency of forced logouts is disproportionate to normal session management expectations and creates friction for routine tasks such as checking a balance. No timestamp is available for when this behaviour began, as the feedback does not specify a date. This issue does not map to any currently documented known issue in the product, suggesting it may be an unreported bug in session token management or expiry configuration.

**Key quotes:**
> Logs me out constantly
> logs me out every couple of days and I have to go through the full
login + 2FA flow again

**Tasks:**
- [Medium] Investigate mobile app session token expiry behaviour — determine whether session TTL is misconfigured, whether token refresh is failing silently, or whether a logout is being triggered by an unhandled error state (assignee: Engineering, deadline: None)
  Acceptance criteria: Root cause of premature session expiry identified and documented; engineering confirms whether this is a configuration issue or a code defect, and provides a reproducible test case or logs showing the trigger condition
- [Medium] If root cause is confirmed as a defect, implement a fix so that mobile sessions persist for the expected duration without requiring repeated full login + 2FA unless a genuine security event (e.g. new device, suspicious activity) occurs (assignee: Engineering, deadline: None)
  Acceptance criteria: QA verifies that a logged-in mobile session remains active across the expected session window without unexpected logouts under normal usage conditions; regression test added to CI pipeline
- [Medium] Check whether this session expiry issue is being reported by other users — search support tickets and app store reviews for similar complaints to assess breadth (assignee: Support Operations, deadline: None)
  Acceptance criteria: A written summary is produced confirming either (a) this appears to be an isolated report, or (b) N additional affected users have been identified, with ticket IDs listed
- [Low] If confirmed as a known issue, add it to the Known Issues register (KI list) with a workaround note until a fix is shipped (assignee: Product, deadline: None)
  Acceptance criteria: Known Issues register updated with a clear description of the symptom, affected surface (mobile app), and any available workaround; internal status visible to support team

**Reply draft:**
> Your session is expiring more frequently than it should — this isn't expected behaviour and we're looking into it.

We're investigating what's causing the mobile app to log you out every few days. We don't have a fix timeline confirmed yet, but the issue has been flagged to our engineering team.

In the meantime, there's no workaround that removes the 2FA step (that's a security requirement we keep in place), but if you run into anything else or the logouts increase in frequency, let us know — it helps us pinpoint the cause faster.

**Review flags:**
- needs_human_review: The reply states we are 'looking into it' and that no fix timeline is confirmed — a human should verify this is accurate against current engineering backlog status before sending, to avoid setting false expectations or contradicting any existing internal communication to this user. (blocks: reply_draft)

---

## CLU-005 — Off-ramp delay exceeding stated 1–3 business day window for contractor payout
- intent_type: actionable_bug
- dimension: Support Process (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-05

**Problem brief:** A payout sent to a contractor in Country A (transaction ref VP-994821) has not been received as of the time this ticket was filed, despite the sender's expectation of a 1–3 business day completion window per Vela Pay's stated policy. The delay is impacting a payroll obligation and causing direct reputational friction between the sender and their contractor. Country A may be one of the destinations currently under review for extended partner bank processing times (KI-4), which can push resolution beyond the typical window to up to approximately seven calendar days. Because no absolute dispatch timestamp was provided in the raw feedback, the precise elapsed duration cannot be confirmed without cross-referencing internal records for VP-994821; all timing assertions in this work pack are therefore conditional on that verification.

**Key quotes:**
> This is a payroll payment and the contractor (based in [Country A]) is messaging us asking what's going on
> Can someone please look into this today? Transaction ref: VP-994821.

**Source refs:** SP-3, KI-4

**Tasks:**
- [High] Pull transaction VP-994821 from internal records: confirm dispatch timestamp, current status in the partner off-ramp chain, and whether Country A is on the KI-4 extended-delay watch list. Document findings before any customer reply is sent. (assignee: Support Operations, deadline: 2026-06-13T17:00:00Z)
  Acceptance criteria: A written status note is attached to ticket #58502 confirming: (1) exact UTC dispatch time, (2) last known off-ramp status event, (3) whether Country A is a KI-4-affected destination, and (4) estimated resolution window from the partner, if obtainable.
- [High] Escalate VP-994821 to the relevant off-ramp partner to request a status update and, where possible, an estimated completion timestamp. Log all partner communications against the ticket. (assignee: Support Operations, deadline: 2026-06-13T17:00:00Z)
  Acceptance criteria: Escalation is confirmed sent to the partner and a response (or acknowledgement of no-SLA) is recorded on the ticket. If a partner-side ETA is obtained, it is shared with the customer in a follow-up message.
- [Medium] Assess whether Country A should be formally added to the KI-4 affected-destinations list and whether the 1–3 business day policy language in SP-3 needs a country-specific caveat in the help centre or dashboard. (assignee: Product, deadline: None)
  Acceptance criteria: A decision is documented: either Country A is added to the KI-4 list with a target remediation date, or it is explicitly cleared with a recorded rationale. If the policy language is to be updated, a draft change is submitted for review within one sprint.

**Reply draft:**
> We've located transaction VP-994821 and are looking into why the funds haven't reached your contractor yet.

Transfers to recipients in some countries can take longer than the typical 1–3 business day window due to processing times at local banking partners — this is outside our direct control, but we've escalated your transaction to our partner now to get a status update.

We'll come back to you with a concrete update — including any estimated completion date the partner can give us — as soon as we have it. We won't leave you waiting on a vague timeline: if we get a specific date, we'll pass it on; if we can't get one, we'll tell you that directly.

In the meantime, if it helps to have anything in writing to share with your contractor, let us know and we can provide a confirmation of the payment dispatch on our side.

**Review flags:**
- needs_human_review: The reply implies the payment was successfully dispatched on Vela Pay's side and attributes the delay solely to the partner off-ramp. This has not yet been verified against internal records for VP-994821 — if the transaction is actually stuck or failed on Vela Pay's side rather than the partner's, the reply would be materially incorrect and could create a policy or liability issue. Human confirmation of the transaction's actual internal status is required before this reply is sent. (blocks: reply_draft)

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft

---

## CLU-006 — Recipient name mismatch between confirmation screen and bank transfer record
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-06

**Problem brief:** A user reported (Ticket #58620) that the confirmation screen displayed a recipient name ('J. Okafor') that differed from the name transmitted to the recipient's bank ('J. Okefor'), causing the recipient's bank to flag the transfer for review. The discrepancy resulted in a 2-day deposit delay. The root cause appears to be a data inconsistency between the name shown on Vela Pay's confirmation screen and the name actually sent to the downstream banking partner. The source of the confirmation screen's name field — and at what point the name diverges from what is transmitted — is currently unknown and requires engineering investigation.

**Key quotes:**
> The confirmation screen showed the recipient name as "J. Okafor" but the actual transfer that landed in their bank shows a different spelling ("J. Okefor")
> Where does the confirmation screen pull the name from?

**Source refs:** SP-3

**Tasks:**
- [High] Investigate the data pipeline for recipient name display on the confirmation screen vs. the name transmitted to the downstream banking partner — identify at which point the name value diverges (e.g. UI rendering, API serialization, partner data mapping) and whether any transformation or truncation is applied (assignee: Engineering, deadline: None)
  Acceptance criteria: A documented root cause identifying the exact system layer where the name mismatch is introduced, with a code or config reference; all name values passed to the confirmation screen and to the banking partner for Ticket #58620 are traceable and reconciled in the investigation write-up
- [High] Audit other recent payout transactions to determine whether the name mismatch between confirmation screen and bank transmission is isolated to Ticket #58620 or a broader systemic issue affecting multiple recipients (assignee: Engineering, deadline: None)
  Acceptance criteria: A quantified report of transactions within the last 90 days where the name on the confirmation screen differed from the name transmitted to the banking partner, with a count and sample of affected transactions; if zero other cases found, the audit methodology is documented
- [High] Implement a fix or data validation check to ensure the recipient name shown on the confirmation screen is identical to the name transmitted to the banking partner, and add an automated test covering name field consistency end-to-end (assignee: Engineering, deadline: None)
  Acceptance criteria: A passing automated test verifies that the name value on the confirmation screen matches the name field in the outbound API payload to the banking partner for a representative set of name formats (including names with initials, diacritics, and spacing variants); no regression in existing payout flow tests
- [High] Escalate Ticket #58620 to the banking partner to request the 2-day review flag on the recipient's deposit be cleared, and update the customer on the outcome (assignee: Support Operations, deadline: None)
  Acceptance criteria: Escalation to the partner is confirmed sent; customer is updated with the partner's response or, if no resolution timeline is available from the partner, the customer is explicitly informed that a timeline cannot be guaranteed per SP-3
- [Medium] Add this name mismatch scenario to the known issues log and assess whether a dashboard warning or pre-confirmation name validation should be added to the product backlog to prevent recurrence (assignee: Product, deadline: None)
  Acceptance criteria: A brief product assessment is documented covering: (1) whether a pre-send name validation against the expected format would catch this class of error, and (2) a go/no-go recommendation for adding it to the roadmap, with rationale

**Reply draft:**
> Your recipient's deposit was delayed because the name on the transfer record didn't match what the confirmation screen showed — we're investigating why those two values differed.

Here's what we know: the confirmation screen displayed 'J. Okafor' but the name transmitted to the recipient's bank was 'J. Okefor'. That discrepancy caused the bank to flag the transfer for review. We're tracing exactly where in the process the name changed and will share a clear answer once we have it.

In parallel, we're escalating to the recipient's banking partner to ask them to clear the review flag. We can't commit to a specific date from their side — that's within their control — but we'll follow up with you directly as soon as we have a response.

We'll be back in touch with both the root cause and the status of the escalation. If the deposit has already cleared on the recipient's end, please let us know so we can close the escalation.

**Review flags:**
- needs_human_review: The reply references escalating to the banking partner to clear the review flag on the recipient's deposit — a support agent should verify the current deposit status (whether it has already cleared or is still held) before sending, to avoid making a commitment to escalate a situation that may already be resolved or that requires a different action based on the live transaction state. (blocks: reply_draft)

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft
- tone_violation: first sentence of reply_draft does not reference transaction/amount/timing

---

## CLU-007 — No scheduled or recurring payout support forces manual re-upload each payroll cycle
- intent_type: feature_request
- dimension: Product/Roadmap (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-07

**Problem brief:** Users with fixed recurring payroll runs must manually re-upload the same CSV every month because Vela Pay has no scheduled or recurring payout functionality. This is a known roadmap item (RM-2) that has not yet been built. The friction is disproportionate for small finance teams who run identical payouts on a regular cadence and gain nothing from the manual re-upload step. There is no known timestamp for when this capability will be available.

**Key quotes:**
> we have to re-upload the same CSV every single month for payroll
> A 'repeat monthly' option, even just for a fixed list of recipients/amounts, would be huge for small teams like ours

**Source refs:** RM-2

**Tasks:**
- [High] Promote RM-2 (scheduled/recurring payouts) to active product scoping: define MVP scope covering at minimum a 'repeat monthly' option for a saved recipient list with fixed amounts, and produce a requirements document for engineering estimation (assignee: Product, deadline: None)
  Acceptance criteria: A scoped requirements document for recurring/scheduled payouts exists, MVP boundaries are agreed, and the feature has an assigned milestone or sprint target on the public-facing or internal roadmap
- [Medium] Log this feedback item against the RM-2 roadmap entry and update the internal demand signal count to reflect confirmed customer interest from at least one SME payroll use case (assignee: Product, deadline: None)
  Acceptance criteria: RM-2 ticket or roadmap entry is updated with a reference to this feedback and the running count of affected customers/use cases is incremented
- [Low] Identify whether a self-service workaround (e.g. saving a recipient template or pre-filling a CSV from a previous upload) can be surfaced in the dashboard to reduce re-upload friction in the interim before RM-2 ships (assignee: Engineering, deadline: None)
  Acceptance criteria: A documented assessment confirms either: (a) a viable interim workaround exists and is added to the help centre or dashboard UI, or (b) no meaningful interim improvement is feasible without the full RM-2 build

**Reply draft:**
> Recurring payouts aren't available yet — every payout currently requires a fresh CSV upload or manual entry. This is something we're actively working to change. The feature you're describing (a repeat option for a fixed recipient list and amounts) is on our roadmap, and your feedback is being logged directly against it to help prioritise timing.

We can't give you a confirmed delivery date right now, but we'll update you when that changes. In the meantime, if there's anything we can do to make the monthly re-upload faster — for example, guidance on structuring your CSV for quicker re-use — reach out and we'll take a look.

**Quality flags:**
- fabricated_quote: quote not found verbatim in any cluster member's raw_text: "A 'repeat monthly' option, even just for a fixed list of recipients/amounts, would be huge for small teams like ours"

---

## CLU-008 — Approval workflow missing for high-value payouts above configurable threshold
- intent_type: feature_request
- dimension: Product/Roadmap (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-08

**Problem brief:** A customer reports that their current Vela Pay account lacks any approval step before payouts are sent, meaning any admin can dispatch large payments — including those over $5,000 — without a second authorizer's sign-off. This is a recognized gap in the v1 role model, which provides only admin/finance/viewer roles without an approval chain. As the customer's team grows, the absence of a configurable approval threshold creates financial control and internal compliance risk. This feature is on the product roadmap (RM-3) but has not yet been built.

**Key quotes:**
> any admin can just send it immediately
> Can you add an approval step for payouts above a configurable threshold?

**Source refs:** RM-3

**Tasks:**
- [Low] Add this ticket to the RM-3 feature demand log and confirm the customer is subscribed to roadmap updates for role-based approval workflows (assignee: Support Operations, deadline: None)
  Acceptance criteria: Ticket #58701 is linked to the RM-3 backlog item and the customer account is tagged for notification when RM-3 ships or enters beta
- [Medium] Review and update the RM-3 product specification to explicitly include: (1) admin-configurable per-threshold approval rules, (2) multi-step approval chain (at least two distinct approver roles), and (3) audit log of approval decisions — in line with this and prior requests (assignee: Product, deadline: None)
  Acceptance criteria: RM-3 spec document includes configurable threshold field, named approver role(s), approval audit trail, and has been reviewed by at least one requesting customer's use-case against the spec
- [Low] Assess whether a lightweight interim workaround (e.g. documentation guidance on using viewer/finance roles to restrict who can initiate payouts) can reduce customer risk until RM-3 is built, and document it in the support knowledge base (assignee: Support Operations, deadline: None)
  Acceptance criteria: A documented workaround or explicit confirmation that no sufficient workaround exists is added to the internal knowledge base and shared with the customer

**Reply draft:**
> Your current account roles — admin, finance, and viewer — don't include an approval chain, so there's no way to require a second sign-off before a payout goes out. That's the gap you've identified.

Configurable approval workflows (where payouts above a set threshold require a second admin's approval before sending) are on our roadmap. We don't have a confirmed release date to share yet, but this request is being logged against that item and you'll be notified when it moves into development or beta.

In the meantime, the most direct way to reduce the risk is to limit which team members hold the admin role — finance-role users can't initiate payouts independently in the same way. That won't give you a formal approval gate, but it narrows who can send without oversight. Let us know if you'd like help reviewing your current role assignments.

---

## CLU-009 — No memo or reference field on outbound payouts for accounting reconciliation
- intent_type: feature_request
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-09

**Problem brief:** Users cannot attach an internal reference number or memo to individual payouts at the time of sending. This makes it difficult to match payout records in Vela Pay's dashboard against invoices or line items in an external accounting system. The limitation applies to both single payouts and batch CSV uploads. No workaround is currently available within the product to tag a payout beyond the recipient identity.

**Key quotes:**
> attach an internal reference number or memo to each payout (e.g. our own invoice number) so it's easier to match against our accounting system later
> right now there's no way to tag a payout with anything beyond the recipient

**Source refs:** KI-3

**Tasks:**
- [Medium] Scope and design a memo/reference field for outbound payouts — covering single payouts, manual entry, and batch CSV uploads — that is stored against each transaction record and surfaced in the dashboard and exported CSV reports (assignee: Product, deadline: None)
  Acceptance criteria: A product spec exists that defines the field (data type, character limit, optional vs. required), covers all payout entry paths (single payout, manual entry, CSV batch), and specifies how the field appears in the transaction history view and in exported CSV reports
- [Medium] Implement memo/reference field on the payout creation flow (single and batch CSV), persisting the value to the transaction record and including it as a dedicated column in exportable CSV reports (assignee: Engineering, deadline: None)
  Acceptance criteria: Users can enter a free-text reference/memo on any outbound payout; the value is visible on the transaction detail page; the exported CSV report includes a dedicated 'Reference/Memo' column populated with the value for each payout where one was provided
- [Low] Update the CSV batch upload template and documentation to include the new optional memo/reference column, with a sample value and field description (assignee: Product, deadline: None)
  Acceptance criteria: The downloadable CSV template includes a 'reference' or 'memo' column; the help documentation explains the field's purpose, character limit, and that it is optional

**Reply draft:**
> Thanks for the specific use case — this is a clear gap. There's currently no way to attach a reference number or memo to a payout, which makes matching records against your own invoicing system unnecessarily manual.

This is on our radar as a planned improvement. We don't have a confirmed release date to share yet, but the request — particularly the need for the reference to appear in exported reports — is exactly the detail that helps us scope it correctly.

We'll note your account against this feature so we can follow up when it ships.

---

## CLU-010 — Support team responding in English to Spanish-language tickets
- intent_type: complaint
- dimension: Support Process (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-10

**Problem brief:** A business customer reports that support tickets submitted in Spanish have been answered entirely in English on at least two occasions. The customer is personally unaffected due to English proficiency, but a colleague who handles most of their support tickets cannot read English, creating a practical barrier to accessing support. No absolute timestamps are available in the submitted feedback; the ticket reference is #58740.

**Key quotes:**
> I submitted my ticket in Spanish and got a reply entirely in English.
> my colleague who handles most of our tickets doesn't, and this has happened twice now.

**Tasks:**
- [Medium] Investigate ticket #58740 and the prior related ticket to confirm both were submitted in Spanish and received English-only replies; document the language detection or routing logic (or absence thereof) that led to these mismatches. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Root cause of the language mismatch is identified and documented — whether it is agent error, absence of a language-matching rule, or a missing language option in the ticketing system.
- [Medium] Define and implement a support language policy: tickets submitted in Spanish (and other non-English languages) must receive replies in the same language. Determine whether this requires multilingual agents, translation tooling, or a routing rule, and implement the chosen solution. (assignee: Support Operations, deadline: None)
  Acceptance criteria: A documented language-matching policy exists and is applied in the ticketing workflow; a test Spanish-language ticket receives a Spanish-language reply without manual escalation.
- [Low] Audit recent ticket history to identify any other customers who submitted non-English tickets and received English-only replies; proactively follow up with those customers in their original language. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Audit is complete; all identified affected customers have received a follow-up in their submitted language.

**Reply draft:**
> We've seen that two of your Spanish-language tickets received replies in English — that's a gap in how we're routing and responding, and we're fixing it.

Going forward, tickets your team submits in Spanish will be answered in Spanish. We're also reviewing whether other customers have run into the same issue.

If there's anything outstanding from those earlier tickets that didn't get resolved clearly, send them our way and we'll respond in Spanish.

---

## CLU-011 — Card transaction currency label mismatch in dashboard display
- intent_type: actionable_bug
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-11

**Problem brief:** A dashboard bug causes card transactions charged in a foreign currency (EUR in this case) to be displayed with an incorrect currency label (USD) while using the foreign currency's raw amount as the number, without applying any conversion. This makes the transaction list and running total visually misleading, even though the actual balance deduction appears to be calculated correctly. The issue is a display-layer inconsistency between the currency code shown and the amount value rendered. No absolute timestamp is available in the submitted feedback; the ticket reference is #58812.

**Key quotes:**
> the dashboard transaction list shows it labeled as USD with the EUR amount as the number (no conversion applied in the display)
> makes the running total look wrong at a glance, even though the actual charge to our balance seems correct

**Tasks:**
- [Medium] Reproduce the currency label/amount mismatch in the dashboard transaction list for foreign-currency card purchases (confirmed with EUR; check all non-USD card transaction currencies). Identify whether the bug is in the data layer (wrong currency code stored) or the display layer (correct data rendered with wrong label). (assignee: Engineering, deadline: None)
  Acceptance criteria: Root cause identified and documented; confirm whether the stored transaction data is correct or also affected. Reproduction steps recorded for at least one additional non-USD currency beyond EUR.
- [Medium] Fix the dashboard so that card transactions display the correct currency code paired with the correctly converted amount in the user's balance currency, or clearly display the original foreign-currency amount with its correct currency code and a separate converted amount. (assignee: Engineering, deadline: None)
  Acceptance criteria: Dashboard transaction list shows the correct currency label and amount for foreign-currency card purchases. Running total accurately reflects actual balance deductions. Verified across at least EUR and one other non-USD currency.
- [High] Check whether the running total calculation displayed in the dashboard is actually correct despite the label mismatch, or whether the visual error masks an underlying calculation error for some users. (assignee: Engineering, deadline: None)
  Acceptance criteria: Confirmed via data audit that balance deductions for foreign-currency card transactions match expected converted amounts. Any discrepancy between displayed and actual balance triggers a separate incident.
- [Low] Add this display bug to the known issues register and assess whether other currency combinations (beyond EUR/USD) are affected. (assignee: Product, deadline: None)
  Acceptance criteria: Known issues register updated with scope of affected currencies. Stakeholders notified of fix timeline once Engineering completes root-cause analysis.

**Reply draft:**
> Your balance deduction looks correct — the underlying charge processed as expected. What's wrong is how the transaction appears in the dashboard: the currency label shows USD when it should show EUR, and the amount displayed is the raw EUR figure without conversion applied. This is a display bug on our end, and we're investigating it now. We'll update you once a fix is in place. In the meantime, your actual balance reflects the correct converted amount, so reconciliation figures drawn from your balance should be accurate — only the transaction list label is misleading.

**Review flags:**
- needs_human_review: The reply asserts that the actual balance deduction is correct and that only the display label is wrong. This claim is based solely on the user's own observation in ticket #58812 and has not been verified against transaction records. If the root cause turns out to affect the stored amount rather than only the display layer, this assertion would be incorrect and potentially misleading about the user's financial position. (blocks: reply_draft)

---

## CLU-012 — Card dispute unresolved beyond the 5-business-day policy window
- intent_type: complaint
- dimension: Support Process (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-12

**Problem brief:** A user submitted a card transaction dispute via the dashboard and, as of the time of submission, has received no response or status change after 12 days — more than double the 5-business-day review window stated in SP-4. The dispute status remains 'under review' with no communication from the support team. This represents a potential policy breach that requires an immediate check of the dispute's internal status and a direct response to the customer. Because no absolute timestamp for the dispute submission was included in the feedback, the exact breach date cannot be calculated here and must be confirmed against ticket records for Ticket #59014.

**Key quotes:**
> Your policy says disputes are reviewed within 5 business days — it's now been more than double that.
> Dashboard still shows "under review".

**Source refs:** SP-4

**Tasks:**
- [High] Pull the dispute record for Ticket #59014 and determine current internal status, who (if anyone) owns it, and whether any communication was sent to the customer since submission. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Internal dispute status confirmed, ownership assigned, and a log of all customer-facing communications since submission produced and attached to the ticket.
- [High] Investigate why this dispute was not resolved or escalated within the 5-business-day window defined in SP-4, and identify whether a systemic queue or routing issue caused the delay. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Root cause of the delay documented; if a systemic issue is found, a count of any other disputes currently exceeding the SP-4 window is produced and flagged to the relevant team lead.
- [High] Resolve the dispute or escalate to the appropriate internal team with a firm internal resolution deadline, then notify the customer of the outcome or next concrete step. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Customer receives a direct update on the dispute outcome or a specific next step with a date; dispute status on the dashboard no longer reads 'under review' without an accompanying explanation.

**Reply draft:**
> Your dispute has been open for 12 days — past the 5-business-day window our policy commits to, and that's not acceptable. We're pulling the record for Ticket #59014 now to find out what happened and where it's stuck.

We'll come back to you with a concrete update — either the outcome of the review or a specific next step and date — within 1 business day. You won't be left waiting without a clear answer again.

**Review flags:**
- needs_human_review: The reply_draft implicitly asserts that the dispute has not been resolved and no communication was sent — this must be verified against the actual ticket record for #59014 before sending. The draft also commits to a 1-business-day follow-up, which requires confirmation from the Support Operations team that they can meet that deadline given current queue load. (blocks: reply_draft)

---

## CLU-013 — Transaction history export capped at 90-day window, blocking single-run year-end reconciliation
- intent_type: feature_request
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-13

**Problem brief:** Users exporting transaction history are limited to a 90-day date range per export. This means a full 12-month export — required for year-end accounting — cannot be produced in a single operation and instead requires four to five separate exports that must be manually combined. No timestamp is available for when this limitation was introduced or reported; the feedback was processed at triage time. The limitation adds meaningful manual overhead for finance teams during high-workload accounting periods and compounds an existing reconciliation gap noted in KI-3.

**Key quotes:**
> we can only go back 90 days at a time
> we'd have to do this in 4-5 separate exports and stitch them together

**Source refs:** KI-3

**Tasks:**
- [Medium] Investigate and document the technical basis for the 90-day export window limit (e.g. query timeout, row cap, UI constraint) and assess effort to extend it to at least 12 months or allow a custom date range (assignee: Engineering, deadline: None)
  Acceptance criteria: A written technical assessment exists documenting the root cause of the 90-day cap and a recommended approach (with effort estimate) for supporting a full 12-month or custom-range export in a single operation
- [Medium] Add a roadmap item for extended transaction history export (minimum 12-month single-run export) and prioritize it alongside the existing KI-3 FX spread line-item work, since both affect year-end reconciliation workflows (assignee: Product, deadline: None)
  Acceptance criteria: A tracked product backlog item exists for extended export range, linked to KI-3, with a clearly stated user story referencing year-end accounting use cases and an assigned target release or review milestone
- [Low] Add a visible in-product notice on the export UI explaining the current 90-day limit and the workaround (run multiple exports and combine), so users are not surprised during time-sensitive accounting periods (assignee: Engineering, deadline: None)
  Acceptance criteria: The export date-range selector displays a clear, plain-language note explaining the 90-day limit and the multi-export workaround before the user attempts to select a longer range

**Reply draft:**
> The transaction history export is currently limited to 90-day windows per export — to cover a full year you'd need to run four exports and combine them, which is exactly the friction you described.

This is a known limitation and we've logged your feedback to prioritize extending the export range to cover at least 12 months in a single run. We don't have a confirmed release date to share yet, but it's on our roadmap and your use case (year-end accounting) is the primary driver.

In the meantime, the four-export approach is the only available workaround. If it helps, you can align each export to a calendar quarter to keep the stitching straightforward: Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec.

We'll update you when an extended export option is available.

---

## CLU-014 — KYB threshold reached without advance notice, payouts now on hold
- intent_type: complaint
- dimension: Compliance (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-14

**Problem brief:** A small business customer crossed the $1,000 cumulative payout volume threshold (per SP-6) and was abruptly prompted to complete KYB verification — including document submission — without prior warning. The customer had no opportunity to prepare the required documents (e.g. registration certificates) before the threshold was reached. As a result, their payouts are currently blocked while they gather materials. No absolute timestamps are available in the feedback; the block is ongoing as of the time this work pack is generated.

**Key quotes:**
> suddenly we're being asked to complete a full KYB process with documents we don't have ready (registration certs, etc.)
> It would've been really helpful to get a heads-up before we hit that limit so we could prepare.

**Source refs:** SP-6

**Tasks:**
- [High] Design and implement a proactive KYB threshold warning: notify business accounts (in-dashboard banner and/or email) when they reach 70–80% of the $1,000 cumulative payout volume limit, listing the documents required to complete KYB before payouts are blocked. (assignee: Product, deadline: None)
  Acceptance criteria: Business accounts receive a threshold warning notification (with document checklist) before hitting the $1,000 limit; warning is confirmed visible in both dashboard and email channel in QA; no account crosses the threshold into a blocked state without having received at least one prior warning.
- [Medium] Audit onboarding and in-product copy to ensure the $1,000 KYB threshold and required documents are clearly communicated at account creation and on the limits/compliance settings page — not only at the point of blocking. (assignee: Product, deadline: None)
  Acceptance criteria: KYB threshold, document requirements, and consequence of non-completion are visible on at least two surfaces before a user reaches the limit (e.g. onboarding checklist and account settings); copy reviewed and approved by a product stakeholder.
- [High] Contact this customer proactively to guide them through the KYB document submission process and confirm whether any in-flight payouts can be expedited once KYB is approved. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Customer is contacted within 1 business day; KYB submission is unblocked or customer has a clear next step; ticket closed only after payout hold is resolved.

**Reply draft:**
> Your payouts are on hold because your account reached the $1,000 cumulative volume threshold that requires business verification (KYB) before sending can continue.

We hear you — you should have received a heads-up before hitting that limit, and not finding out at the moment payouts stopped is a genuine gap on our end. We're looking at how to fix that.

Here's what to do now: submit your KYB documents through the dashboard's verification section. The documents typically required include your business registration certificate and proof of business address — our support team can walk you through the exact list for your account type.

Once your submission is in, our team will review it and re-enable your payouts. If you'd like direct help getting the documents submitted, reply here and we'll assist you through it.

**Review flags:**
- needs_human_review: The reply states the customer's payouts are on hold and implies they will be re-enabled upon KYB approval — a support agent should verify the actual account state (e.g. whether specific in-flight payouts are queued, partially processed, or fully blocked) before sending, to ensure the timing and resolution commitment are accurate for this account. (blocks: reply_draft)

---

## CLU-015 — Onboarding/welcome email not delivered after account signup
- intent_type: actionable_bug
- dimension: Support Process (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-15

**Problem brief:** A business that completed account signup reports never receiving an onboarding or welcome email, leaving them unaware their account was active. The feedback was submitted at an unspecified date; based on the account being created approximately one week prior to submission, the signup occurred no earlier than roughly 2025-07-07T00:00:00Z. The absence of a confirmation or onboarding email created significant confusion and nearly caused the user to abandon the platform entirely. This appears to be a deliverability or triggering failure in the post-signup email flow rather than a user error.

**Key quotes:**
> we signed up about a week ago but never got any onboarding/welcome email
> we only found out our account was active because someone tried logging in

**Tasks:**
- [High] Investigate whether the onboarding/welcome email trigger fired for this account after signup, and whether the email was sent, bounced, or silently dropped; pull send logs for the affected account (assignee: Engineering, deadline: None)
  Acceptance criteria: Root cause identified (trigger failure, delivery failure, or spam filtering) and documented; confirmation of whether this is an isolated incident or a systemic issue affecting other recent signups
- [High] Audit recent signups (past 30 days) for any other accounts that did not receive a post-signup onboarding email, to determine the scope of the issue (assignee: Engineering, deadline: None)
  Acceptance criteria: Full list of affected accounts identified; count confirmed and shared with Product and Support Operations; any pattern in affected accounts (e.g. email domain, signup method, time window) documented
- [High] Manually send the onboarding email to the affected account as an immediate remediation step, and confirm delivery (assignee: Support Operations, deadline: None)
  Acceptance criteria: Onboarding email successfully delivered to the customer's inbox and delivery confirmed via send logs; customer acknowledges receipt if possible
- [Medium] Add a monitoring alert for post-signup email delivery failures so silent drops are caught within 24 hours of occurrence going forward (assignee: Engineering, deadline: None)
  Acceptance criteria: Alert is live and tested; at minimum one simulated failure triggers the alert within the defined window
- [Medium] Evaluate whether a fallback confirmation mechanism (e.g. in-app banner on first login confirming account activation status) should be added to prevent users from being unaware their account is active if email delivery fails (assignee: Product, deadline: None)
  Acceptance criteria: Decision documented with rationale; if approved, added to backlog with acceptance criteria defined for the in-app fallback feature

**Reply draft:**
> Your account was fully active from the moment signup completed — the onboarding email didn't reach you, which is a gap on our end.

We're sending the onboarding email to you now. If it doesn't appear in your inbox within the next few minutes, check your spam folder — if it's there, marking it as safe will ensure future Vela Pay emails get through.

Your account is ready to use. If you have questions about getting started or need anything walked through, reply here and we'll help directly.

**Review flags:**
- needs_human_review: The reply_draft asserts that the account was fully active from signup and that the failure was on Vela Pay's end. Before sending, support should verify in the backend that this specific account's signup did complete successfully and that the email trigger did fire (or provably failed), rather than assuming the account state is clean. If the signup itself is in a partial or errored state, the reply would be materially incorrect. (blocks: reply_draft)

---

## CLU-016 — Admin account lockout blocking time-sensitive payroll batch
- intent_type: actionable_bug
- dimension: Support Process (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-16

**Problem brief:** A primary admin user lost access to their 2FA device and is fully locked out of their Vela Pay account. The lockout was reported with payroll due the following morning, creating a hard time constraint on account recovery. Per SP-10, manual verification by the support team is required for primary admin recovery and may take up to 2 business days — a window that conflicts with the user's stated payroll deadline. No workaround exists for sending batch payouts without admin access.

**Key quotes:**
> Lost my phone with the 2FA app on it last night
> We have payroll due tomorrow morning and I can't access the account at all to send the batch

**Source refs:** SP-10, KI-1

**Tasks:**
- [High] Locate Ticket #59140 and initiate expedited manual admin account recovery verification for this user. Confirm identity via whatever out-of-band verification the support team can complete fastest (e.g. email domain match, KYB documents on file, callback to registered business number). Do not use the standard 2-business-day queue — flag as urgent given stated payroll deadline. (assignee: Support Operations, deadline: 2024-01-01T08:00:00Z)
  Acceptance criteria: Admin account access is restored and confirmed by the user before their stated payroll deadline, OR the user is explicitly notified that restoration cannot happen in time and is given a concrete updated ETA.
- [Medium] Review whether the account recovery SLA in SP-10 ('up to 2 business days') can be tiered or expedited for cases with documented time-critical payroll impact. If an expedited path exists informally, document it formally. If it does not exist, raise as a product/policy gap to Product and Support Ops leads. (assignee: Support Operations, deadline: None)
  Acceptance criteria: A written policy decision exists on whether/how urgent account recovery cases (e.g. payroll blockers) can be escalated to a faster path, including any additional verification steps required.
- [Medium] Evaluate whether the 2FA recovery flow can surface an alternative verification path (e.g. backup codes, secondary admin, support escalation link) before the user is fully locked out, to reduce support load on cases like this. (assignee: Product, deadline: None)
  Acceptance criteria: A design proposal or decision memo exists describing at least one alternative 2FA recovery path that does not require full manual support intervention, with an assessment of security tradeoffs.

**Reply draft:**
> Your account recovery is being treated as urgent — the support team is picking up Ticket #59140 now and starting manual verification immediately.

To complete verification, we'll need to confirm your identity against the records on your business account. A support team member will reach out to you directly via your registered email within the next few hours to work through this. We'll move as fast as the verification steps allow.

One thing to be transparent about: our standard account recovery process can take up to 2 business days (SP-10), and we can't guarantee completion before tomorrow morning — but we're prioritizing this and will update you as soon as verification is done. If recovery can't complete in time, we'll tell you that clearly so you can make alternative arrangements.

Do not reply to this message with passwords or full financial details — the support team will only ask for identity verification information through secure channels.

**Review flags:**
- needs_human_review: The reply implies expedited handling and 'within the next few hours' contact — this is a timing commitment that support operations must confirm is actually achievable before the reply is sent. Sending this reply without confirming capacity creates a broken promise on a time-critical payroll situation. (blocks: reply_draft)

**Quality flags:**
- fabricated_quote: quote not found verbatim in any cluster member's raw_text: 'Lost my phone with the 2FA app on it last night'
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft
- tone_violation: first sentence of reply_draft does not reference transaction/amount/timing

---

## CLU-017 — Positive feedback on dashboard clarity, onboarding speed, and support responsiveness
- intent_type: praise
- dimension: Other/Uncategorized (2), Support Process (1), UX (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-17, FB-18, FB-19, FB-25

**Problem brief:** Multiple users submitted praise across four feedback items highlighting three distinct strengths: the dashboard's clean, uncluttered layout; the speed and simplicity of KYB onboarding (one user reported submission-to-approval in under 36 hours); and responsive support chat for card-limit questions. No issues or action items are raised. This cluster surfaces positive signal worth sharing with relevant product and support teams.

**Key quotes:**
> KYB approval was much faster than we expected — submitted Tuesday, approved by Wednesday afternoon. Other providers took us almost two weeks.
> Clean, no-nonsense dashboard

**Reply draft:**
> Thanks for sharing this — genuinely good to hear. Fast KYB, a clear dashboard, and support that doesn't drag things out are all things we care about getting right, so it's useful to know they're landing well. We'll make sure this gets back to the teams involved.

---

## CLU-018 — Low-signal feedback: Apple Pay curiosity and vague UX dissatisfaction
- intent_type: noise
- dimension: Other/Uncategorized (2)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-20, FB-21

**Problem brief:** Two feedback items with no actionable signal were grouped into this cluster. FB-20 is a casual, self-described non-urgent question about Apple Pay support, which is outside Vela Pay's current product scope (B2B corporate cards only). FB-21 is a two-star review with no specific complaint, describing the app as 'clunky' without identifying any particular feature, flow, or failure. Neither item contains enough detail to drive a product decision, bug investigation, or support response.

---

## CLU-019 — SMS 2FA codes not delivered for users on a specific mobile carrier
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-22

**Problem brief:** Two users on the same mobile carrier are unable to receive SMS-based 2FA codes as of the week containing the ticket submission (Ticket #59288), preventing them from logging in. All other team members on different carriers are unaffected, indicating a carrier-specific delivery failure rather than a platform-wide 2FA outage. The root cause — whether a carrier routing block, SMS gateway configuration issue, or a third-party delivery provider problem — has not yet been determined. There are no context documents identifying this as a known issue, so engineering investigation is required to confirm scope and cause.

**Key quotes:**
> Two of our team members (both on the same mobile carrier) stopped receiving 2FA codes via SMS this week
> codes for everyone else arrive fine

**Source refs:** SP-10

**Tasks:**
- [High] Investigate SMS 2FA delivery failure for users on the reported mobile carrier: check SMS gateway logs, carrier routing status, and delivery receipts for the affected phone numbers to determine whether this is a carrier-side block, a gateway filtering issue, or a platform configuration problem (assignee: Engineering, deadline: None)
  Acceptance criteria: Root cause identified and documented; confirmed whether failure is isolated to one carrier or broader; affected users can successfully receive 2FA codes or a tested workaround (e.g. authenticator app) is available and communicated
- [High] Provide the two affected users with an immediate workaround to regain login access — e.g. switching to a TOTP authenticator app — and document the steps in the support reply (assignee: Support Operations, deadline: None)
  Acceptance criteria: Both affected users confirm they can log in using the workaround; no account recovery escalation required under SP-10
- [Medium] Determine whether the SMS 2FA carrier-delivery issue affects other customers on the same carrier across the user base and assess whether a status page update or proactive outreach is warranted (assignee: Support Operations, deadline: None)
  Acceptance criteria: Scope confirmed (isolated to this account vs. broader); decision made and documented on whether proactive customer communication is needed

**Reply draft:**
> The two team members affected can't log in right now, and we want to get them unblocked immediately while we investigate the delivery issue on our end.

The fastest workaround: switch those accounts from SMS codes to a TOTP authenticator app (Google Authenticator, Authy, or similar). This doesn't depend on carrier delivery and will restore access without waiting for the SMS issue to be resolved. If either account is fully locked out and can't complete the switch without support, reply here with the account details and we'll handle it manually — account recovery takes up to 2 business days under our standard process, but we'll prioritize these given the active block.

On the SMS side: our team is checking delivery logs and carrier routing for the affected numbers now. The pattern you've described — same carrier, everyone else fine — points to a carrier-specific routing or filtering issue rather than a platform-wide problem. We'll update you once we've confirmed the cause and whether it affects anyone else on the same carrier.

If you want to proceed with the authenticator app switch, let us know and we'll send the re-enrollment steps.

**Review flags:**
- needs_human_review: The reply references the SP-10 account recovery timeline (up to 2 business days) in the context of potentially locked-out accounts. Before sending, a human should verify the actual lock state of both affected user accounts — if either is not yet fully locked out, the 2-day recovery framing is premature and could create unnecessary alarm. Additionally, the reply commits to a manual prioritization of recovery that should be confirmed as operationally feasible by the Support Operations team. (blocks: reply_draft)

**Quality flags:**
- tone_violation: first sentence of reply_draft does not reference transaction/amount/timing

---

## CLU-020 — FX spread shown in transaction details differs from spread confirmed at checkout
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-23

**Problem brief:** A user confirmed a currency conversion at a specific FX spread, but the transaction details page subsequently displayed a spread approximately 0.3% higher than what was shown at confirmation (transaction ref VP-100442). Per SP-8, the spread disclosed at confirmation must not change retroactively on an already-confirmed transaction. This discrepancy — whether caused by a display bug, a data-pipeline timing issue, or an incorrect post-confirmation rate application — requires investigation to determine whether the customer was charged incorrectly and whether other transactions are affected.

**Key quotes:**
> the spread shown was different from what I confirmed — about 0.3% higher
> It's not a huge amount in absolute terms, but it shouldn't change after I've already confirmed it, right?

**Source refs:** SP-8, KI-3

**Tasks:**
- [High] Retrieve transaction VP-100442 and compare the spread value stored at confirmation time against the spread value displayed in transaction details post-confirmation; determine whether the customer was charged the higher spread or only shown it incorrectly (assignee: Support Operations, deadline: None)
  Acceptance criteria: A written finding is produced stating: (a) which spread value was actually applied to the settlement amount, (b) whether the two values differ, and (c) whether a financial correction is owed to the customer — verified against ledger records, not UI display alone
- [High] Audit the transaction detail view rendering logic to identify why the displayed spread for VP-100442 (and potentially other transactions) does not match the spread locked at confirmation; determine whether this is a display bug or a genuine rate mutation post-confirmation (assignee: Engineering, deadline: None)
  Acceptance criteria: Root cause is documented; a fix or remediation plan is scoped; Engineering can confirm whether the discrepancy is cosmetic (display only) or affects the charged amount; scope of affected transactions is quantified
- [High] If investigation confirms the customer was charged the higher spread rather than the confirmed rate, initiate a refund of the difference for transaction VP-100442 and identify any other transactions affected by the same issue (assignee: Support Operations, deadline: None)
  Acceptance criteria: Customer balance is corrected to reflect the spread rate they confirmed; all similarly affected transactions within the same root-cause window are identified and remediated; customer is notified of the outcome
- [Medium] Assess whether the post-confirmation spread discrepancy is related to the known gap in FX spread line-item reporting (KI-3) or is a separate bug, and update the known issues register accordingly (assignee: Product, deadline: None)
  Acceptance criteria: Product has documented a clear determination of whether this is a new distinct issue or a manifestation of KI-3; known issues register is updated; if distinct, a new issue entry is created with reproduction steps

**Reply draft:**
> We've pulled up transaction VP-100442 and are investigating why the spread shown in the transaction details is higher than the one you confirmed before the conversion went through.

Per our policy, the spread locked in at confirmation is the rate that applies — it doesn't change after you've confirmed. If the investigation finds that a higher spread was actually charged rather than just displayed incorrectly, we'll correct the difference to your balance.

We'll come back to you once we have a clear answer on whether this is a display issue or something that affected the charged amount. We'll aim to have an update for you within 1 business day.

**Review flags:**
- needs_human_review: The reply implies a financial correction may be owed ('we'll correct the difference to your balance') and references a specific transaction (VP-100442) with a specific rate discrepancy. A human must verify against ledger records whether the customer was actually charged the higher spread or whether the discrepancy is display-only before this reply is sent — the reply as drafted could create a financial commitment that is not yet confirmed by investigation. (blocks: reply_draft)

---

## CLU-021 — Dark mode requested for dashboard reconciliation use
- intent_type: feature_request
- dimension: UX (1)
- signal_strength: Low
- confidence: High
- cluster_members: FB-24

**Problem brief:** A user has submitted a feature request for a dark mode option on the Vela Pay dashboard, citing usability during late-night reconciliation sessions. This is a UI/UX enhancement with no safety, compliance, or payment-flow implications. The request was received as a single feedback item and reflects a common quality-of-life preference seen across B2B SaaS platforms. No existing roadmap item (RM-1 through RM-4) or known issue addresses this request.

**Key quotes:**
> dark mode for the dashboard — easier on the eyes for late-night reconciliation sessions

**Tasks:**
- [Low] Log dark mode as a formal feature request in the product backlog, tagging it as a UI/UX enhancement for the dashboard. Link to this feedback item as supporting evidence. (assignee: Product, deadline: None)
  Acceptance criteria: Feature request is recorded in the backlog with category 'UI/UX', status 'Under consideration', and a reference to feedback item FB-24.
- [Low] Assess feasibility of dark mode implementation: audit current dashboard theming architecture to determine whether a CSS/design-token approach already supports theme switching, and estimate development effort. (assignee: Engineering, deadline: None)
  Acceptance criteria: A written feasibility note is added to the backlog ticket covering: whether the current design system supports theming, estimated effort range (e.g. days/weeks), and any dependencies (e.g. component library, third-party widgets that may not support dark mode).

**Reply draft:**
> Thanks for the suggestion. Dark mode for the dashboard isn't available yet, but we've logged this as a feature request and it'll be considered for a future release. We can't commit to a timeline right now, but your feedback is on record. If this gets prioritised, we'll communicate it in our product updates.

---

## CLU-022 — Multi-entity account structure: managing multiple subsidiaries under a single login
- intent_type: feature_request
- dimension: Product/Roadmap (2)
- signal_strength: High
- confidence: High
- cluster_members: FB-28, FB-29

**Problem brief:** Multiple customers report that managing more than one legal entity on Vela Pay requires maintaining separate accounts and performing separate logins for each entity, with no consolidated reporting across them. This is a known gap in the current product: multi-entity and subsidiary account structures are explicitly out of scope for v1 and are tracked on the roadmap as RM-1. The feedback was received as of the time of this triage; no absolute submission timestamps are embedded in the raw feedback items, so no UTC timestamps can be stated. Two distinct business customers have independently raised this request, signaling real demand from SME groups with multiple legal entities.

**Key quotes:**
> manage all of them under a single login with consolidated reporting
> there's no way to see a combined view across them

**Source refs:** RM-1

**Tasks:**
- [Medium] Log both FB-28 and FB-29 against the RM-1 roadmap item in the product backlog, tagging them as validated demand signals from distinct multi-entity customers; record the specific use cases (subsidiary management, group-level consolidated reporting) to inform scoping. (assignee: Product, deadline: None)
  Acceptance criteria: Both feedback items are linked to the RM-1 backlog item with use-case notes; product manager confirms the demand signal is reflected in roadmap prioritization documentation.
- [Medium] Define and document the minimum viable scope for multi-entity account support: shared parent login, per-entity balance isolation, cross-entity consolidated reporting view, and role/permission model across entities. Produce a scoping brief for engineering estimation. (assignee: Product, deadline: None)
  Acceptance criteria: A written scoping brief exists covering at minimum: account hierarchy model, login and permission approach, consolidated reporting requirements, and open questions for legal/compliance review. Brief is reviewed by at least one engineering lead.
- [Medium] Assess compliance and KYB implications of a multi-entity account structure — specifically whether a single KYB can span subsidiaries or whether each entity requires independent KYB, and how transaction monitoring applies across a consolidated account. (assignee: Compliance, deadline: None)
  Acceptance criteria: Compliance team produces a written position on per-entity vs. per-group KYB requirements and flags any regulatory constraints that would affect the RM-1 design, delivered to Product before engineering scoping begins.
- [Low] Identify any other customers who have raised multi-entity account requests (historically or in open support tickets) and consolidate into a demand register to support roadmap prioritization. (assignee: Support Operations, deadline: None)
  Acceptance criteria: A list of customers or tickets citing multi-entity needs is produced and shared with Product; list includes company size and number of entities where available.

**Reply draft:**
> Multi-entity account management is on our roadmap — we don't have a release date confirmed yet, but this is something we're actively planning to build.

Right now, each legal entity does require its own separate account and login, and there's no consolidated view across them. We know that's a real operational overhead for finance teams managing multiple subsidiaries.

When we do build this, the intent is to support a single parent login with access to multiple entities and combined reporting across them. We'll reach out directly when we have a confirmed timeline or early access opportunity.

In the meantime, if there are specific workflows — for example, a particular reporting format or approval structure across entities — that would be most important to get right, we'd welcome that input to share with the product team.

**Review flags:**
- needs_human_review: The reply_draft references intended future functionality ('the intent is to support a single parent login with access to multiple entities and combined reporting') derived from RM-1 roadmap language. A human should verify this accurately reflects current product direction before it is sent, as the roadmap description is high-level and the reply could be read as a soft commitment. This risk applies to both FB-28 and FB-29 — the two customers are distinct accounts and a product manager should confirm the characterization is consistent with what can be communicated to each. (blocks: reply_draft)

---
