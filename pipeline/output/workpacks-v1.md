# Asterline — Work Packs

## CLU-001 — Batch CSV upload silently fails with no error message above 500-row limit
- intent_type: actionable_bug
- dimension: Engineering (3)
- signal_strength: High
- confidence: High
- cluster_members: FB-01, FB-26, FB-27

**Problem brief:** Three customers attempted batch payout uploads of 620, 540, and 700 rows respectively and received no error message or confirmation — the upload simply hung indefinitely, forcing each to manually split their files and resubmit, costing significant operational time. This is a documented platform limitation (KI-1) with a known 500-row threshold, but the absence of any in-product error message means customers cannot self-diagnose or apply the workaround without external support.

**Key quotes:**
> no error, no confirmation, page just sat there for 10+ minutes
> We had no way of knowing whether the payments had gone out.

**Source refs:** KI-1

**Tasks:**
- [High] Investigate the silent failure behavior on CSV batch uploads exceeding 500 rows — confirm the exact row threshold, identify why no validation error or user-facing message is surfaced when the limit is breached, and document the root cause and scope of affected upload attempts. (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written root-cause summary identifying the specific failure mode (e.g. missing input validation, silent timeout, absent error-handling path), confirmed row threshold, and list of any affected accounts where uploads may have appeared to complete but did not — reviewed and signed off by Product.
- [High] Review the Engineering root-cause summary for the silent batch upload failure, determine fix priority relative to current roadmap, and authorize the fix scope — specifically whether to implement a client-side row-count validation with a clear error message, a server-side rejection with an explicit response, or both. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written priority decision and fix authorization on record, including the approved error-message text and the validation layer(s) to be targeted, before Engineering proceeds to implementation.
- [High] Implement the authorized input validation fix so that batch CSV uploads exceeding the row limit are immediately rejected with a clear, specific error message stating the limit and directing the user to split their file. (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Uploading a CSV with more than 500 rows produces a visible, specific error message (e.g. 'This file contains [N] rows — the maximum per upload is 500. Please split your file and resubmit.') within the normal page response time; no silent hang or spinner-without-feedback behavior occurs; verified by QA with files at 499, 500, 501, and 700+ rows.

**Reply draft:**
> We're sorry your batch upload hung with no error message — that's not acceptable behavior, and we understand it cost your team real time to diagnose and work around.

The platform currently has a 500-row limit per CSV upload, and right now it fails silently when that limit is exceeded rather than telling you what went wrong. Splitting into files of 500 rows or fewer will get your batches through in the meantime.

We've raised a fix to surface a clear error message when the limit is hit so this is self-diagnosable going forward. You'll see the change noted in our changelog when it ships — [changelog URL placeholder].

**Review flags:**
- needs_human_review: This reply is a template across three separate customers (FB-01, FB-26, FB-27). Before sending, each version must be verified against the recipient's account to confirm whether any of the oversized upload attempts resulted in partial or duplicate payment execution — if any payments were sent or funds were debited despite the apparent hang, the reply must be revised to address that specific account state before it is sent. (blocks: reply_draft)

---

## CLU-002 — Pre-confirmation payout amount mismatches post-debit amount — undisclosed FX charge
- intent_type: actionable_bug
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-02

**Problem brief:** One customer reports that the dashboard displayed $5,000.00 before confirming a payout, but their bank statement shows a debit of $5,012.40, with the $12.40 difference not itemized anywhere in the dashboard or confirmation flow. This directly conflicts with Vela Pay's policy that the FX spread is disclosed to the user before transaction confirmation, and aligns with the known issue that the exportable CSV report buries FX costs in the total rather than showing them as a separate line item.

**Key quotes:**
> The dashboard showed our payout as $5,000.00 before confirmation, but our bank statement shows we were debited $5,012.40.
> The extra $12.40 isn't itemized anywhere — is this an FX adjustment? If so it should be shown before we confirm, not discovered afterward.

**Source refs:** SP-8, KI-3

**Tasks:**
- [High] Investigate whether the pre-confirmation amount displayed to this customer failed to include the FX conversion fee, determine whether this is an isolated display bug or a systemic failure in the confirmation flow's fee disclosure, and document the root cause with the specific transaction path affected (payout amount, destination country, conversion pair). (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written root-cause summary identifying whether the $12.40 discrepancy represents an undisclosed FX spread, a fee applied post-confirmation in violation of SP-8, or a display rendering error — reviewed and signed off by Product before any customer communication about the specific amount.
- [High] Review the Engineering root-cause finding, assess whether SP-8 was violated for this transaction (and potentially others), determine the scope of affected accounts, authorize the fix approach for the confirmation screen's fee disclosure, and decide whether affected customers are owed a remediation action. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written priority decision on record that specifies: (1) whether this is a confirmed SP-8 violation, (2) the estimated number of affected transactions, (3) authorized fix scope for Engineering, and (4) whether a customer remediation process should be initiated.

**Reply draft:**
> The amount shown at confirmation should match what gets debited — a $12.40 difference appearing only on your bank statement, with no itemization in the dashboard, is not how this should work, and we're investigating it now.

We're looking into whether the conversion fee was applied after confirmation rather than disclosed before it, as it should be. We can't confirm the specific cause or the correct amount until that review is complete, so we won't speculate on the $12.40 here. Once our investigation is done, we'll follow up with a clear explanation of the charge and what happens next — including whether any adjustment is owed.

**Review flags:**
- needs_human_review: The reply references the specific dollar amounts ($5,000.00 and $12.40) from the customer's account. Before sending, a support agent must verify the actual transaction record to confirm the discrepancy is real, determine whether SP-8 was violated (fee applied post-confirmation), and establish whether a refund or adjustment is owed. The reply deliberately avoids committing to an outcome — but the mention of 'whether any adjustment is owed' must be authorized by Product's review decision before the reply is sent. (blocks: reply_draft)

---

## CLU-003 — API/webhook support for real-time payout status updates
- intent_type: feature_request
- dimension: Engineering (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-03

**Problem brief:** One customer is requesting programmatic payout status notifications — either via webhook callbacks or a polling API endpoint — covering state transitions such as pending, sent, completed, and failed. This capability does not currently exist in v1; finance teams must check the dashboard manually to track payout outcomes, which creates friction for customers who maintain their own internal systems.

**Key quotes:**
> webhook (or API polling endpoint) when a payout moves between statuses (pending/sent/completed/failed)
> update our internal systems automatically instead of checking the dashboard manually

**Source refs:** RM-2

**Tasks:**
- [Medium] Document the reported need for payout status webhooks and API polling, capturing the specific state transitions requested (pending/sent/completed/failed) and the integration use case (syncing internal systems without dashboard polling), and evaluate whether this fits within the existing roadmap or should be scoped as a distinct API surface item alongside RM-2 scheduled payouts work. (assignee: Product, deadline: None)
  Acceptance criteria: A written product note exists capturing the request details, the frequency of demand relative to other roadmap items, and a documented decision on whether to open a formal scoping workstream or defer — reviewed and signed off by the product owner.

**Reply draft:**
> Thanks for this — knowing exactly when a payout changes state without having to check the dashboard is a real workflow win, especially for teams keeping internal systems in sync. We don't have webhook or API status callbacks available today, but this is the kind of integration capability we're tracking as the platform matures. You'll see it in our changelog when it ships — [changelog URL placeholder].

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft

---

## CLU-004 — Mobile app session expires too frequently, forcing repeated full login and 2FA
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-04

**Problem brief:** One customer reports the mobile app logs them out every few days, requiring a full login and 2FA re-authentication each time. No known issue or documented session-timeout policy covers this behavior, so it is unclear whether this is an intentional session length, a token expiry bug, or a device-specific fault.

**Key quotes:**
> Logs me out every couple of days and I have to go through the full login + 2FA flow again
> Annoying when I just want to quickly check a balance

**Tasks:**
- [Medium] Investigate the mobile app session management behavior — reproduce the reported logout cycle, determine whether sessions are expiring prematurely due to a bug (e.g. token refresh failure, incorrect TTL configuration) or per an intentional policy, and document the root cause including any affected session types or device configurations. (assignee: Engineering, deadline: None)
  Acceptance criteria: Written root-cause summary identifying whether logout frequency is a defect or intended behavior, including affected scope (e.g. iOS/Android, specific app versions), reviewed and signed off by Product.
- [Medium] Review the Engineering root-cause finding, determine the intended session lifetime policy for the mobile app, and authorize a fix or configuration change if the current behavior deviates from it. If the session length is intentional, confirm whether UX guidance or in-app messaging should be added to set expectations. (assignee: Product, deadline: None)
  Acceptance criteria: Written priority decision on record: either fix authorized with defined acceptance behavior (e.g. session persists for X days under normal use), or documented rationale that current behavior is intentional plus a decision on any UX mitigation.

**Reply draft:**
> Your app is logging you out every few days — that's more frequent than it should be, and we're looking into what's causing it. We'll investigate the session behavior and follow up once we have a clear answer on whether this is a bug or something we need to adjust.

**Review flags:**
- needs_human_review: No session timeout policy or known issue exists in the reference documents to confirm whether this logout frequency is a bug or intended behavior. The reply_draft makes an implicit commitment that the behavior is wrong — a reviewer should confirm this before sending. (blocks: reply_draft)

---

## CLU-005 — Off-ramp payout delay exceeding stated 1–3 business day window — contractor payment outstanding
- intent_type: actionable_bug
- dimension: Support Process (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-05

**Problem brief:** A payout sent via transaction VP-994821 has not been received by the contractor recipient after 6 business days, breaching the 1–3 business day typical resolution window stated in support policy. The recipient is located in a country that may be among those currently experiencing extended partner bank processing delays per KI-4, which can stretch to approximately 7 days.

**Key quotes:**
> We sent a payout to one of our contractors 6 days ago and they still haven't received the funds.
> This is a payroll payment and the contractor (based in [Country A]) is messaging us asking what's going on

**Source refs:** SP-3, KI-4

**Tasks:**
- [High] Investigate transaction VP-994821: confirm the payout reached the off-ramp partner, identify the current hold point, determine whether the recipient's country is among those listed under KI-4 as experiencing extended partner bank delays, and document a root-cause summary including current status and expected resolution window. (assignee: Support Operations, deadline: OVERDUE — immediate review required)
  Acceptance criteria: Written status update on VP-994821 confirming: (1) whether funds cleared Vela Pay's system, (2) which partner bank or off-ramp leg is holding the delay, (3) whether the recipient country is a KI-4-affected destination, and (4) a realistic resolution estimate based on current partner status — reviewed and signed off before reply_draft is sent to the customer.
- [High] Review the Support Operations finding for VP-994821 and determine whether this delay constitutes a Vela Pay or partner-side failure, assess whether escalation to the off-ramp partner is warranted, and authorize the appropriate response path — including whether a goodwill gesture or expedited escalation track applies given the payroll-critical nature of the payment. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written decision on record covering: (1) failure classification (Vela Pay system vs. partner bank), (2) whether partner escalation is being initiated, (3) any applicable goodwill or remediation action authorized, and (4) the customer-facing timeline commitment that can be included in the reply.

**Reply draft:**
> We're sorry your contractor hasn't received this payment — a payout sitting undelivered after 6 days is outside the window you should expect, and we understand this is putting you in a difficult position with your contractor.

We're looking into transaction VP-994821 now to identify exactly where the delay is. A small number of destinations are currently experiencing longer-than-usual processing times through local banking partners, which may be a factor here — but we need to confirm the specifics before giving you a reliable timeline.

We'll follow up with a status update and a concrete expected delivery window as soon as we've confirmed the current position with our partner — we're treating this as urgent.

**Review flags:**
- needs_human_review: The reply_draft does not yet include a specific resolution timeline because the Support Operations investigation (task 1) has not been completed. Sending this reply before confirming whether VP-994821 is stuck at the off-ramp partner — and whether the recipient country is KI-4-affected — risks either under- or over-committing on timing for an active payroll payment. The reply must be updated with a confirmed timeline from the investigation before it is sent. (blocks: reply_draft)

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft

---

## CLU-006 — Recipient name mismatch between confirmation screen and bank transfer record
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-06

**Problem brief:** One customer reports that the name displayed on the payout confirmation screen ('J. Okafor') differed from the name transmitted to the recipient's bank ('J. Okefor'), causing the recipient's bank to flag the transfer and delay deposit by two days. The root cause — whether the confirmation screen is pulling from a different data source than the field sent to the payment rail — is unknown and requires engineering investigation.

**Key quotes:**
> The confirmation screen showed the recipient name as 'J. Okafor' but the actual transfer that landed in their bank shows a different spelling ('J. Okefor')
> Where does the confirmation screen pull the name from?

**Tasks:**
- [High] Investigate the data pipeline for recipient name display on the confirmation screen versus the name transmitted to the payment rail. Determine whether the confirmation screen reads from a different field, data layer, or transformation step than the value sent downstream, reproduce the mismatch using the affected transaction, and document the root cause including scope of potentially affected transactions. (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written root-cause summary identifying the specific point of divergence between the displayed name and the transmitted name, with scope assessment (isolated incident vs. systemic), reviewed and signed off by Product.
- [High] Review the Engineering root-cause finding, assess whether the name mismatch represents a systemic data integrity issue or an isolated edge case, and authorize the fix scope and approach — including whether affected senders should be proactively notified. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written priority decision and fix authorization on record, with a documented stance on customer communication scope.

**Reply draft:**
> Your payout confirmation showed one spelling of the recipient's name while the transfer reached their bank under a different spelling — that discrepancy should not happen, and we're sorry it caused a two-day delay on their end.

We're investigating where the name shown on the confirmation screen diverges from what gets sent to the bank. Once we have a root-cause answer we'll follow up with what happened and what we're doing to prevent it.

**Review flags:**
- needs_human_review: The reply implicitly acknowledges a system error on Vela Pay's part (name data mismatch). Before sending, confirm via the transaction record for ticket #58620 whether the mismatch originated in Vela Pay's system or was present in the recipient details as entered by the sender — this affects both the apology framing and any applicable policy (SP-1 vs. SP-2). (blocks: reply_draft)

---

## CLU-007 — No recurring or scheduled payout support — manual CSV re-upload required each cycle
- intent_type: feature_request
- dimension: Product/Roadmap (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-07

**Problem brief:** One customer reports that running monthly payroll requires re-uploading the same CSV every cycle, with no option to schedule or automate repeat payouts for a fixed recipient/amount list. This is a known roadmap gap: scheduled and recurring payouts are not yet supported in v1.

**Key quotes:**
> we have to re-upload the same CSV every single month for payroll
> A 'repeat monthly' option, even just for a fixed list of recipients/amounts, would be huge for small teams like ours

**Source refs:** RM-2

**Tasks:**
- [Low] Document the reported need for recurring/scheduled payouts, capturing the specific use case of fixed monthly payroll runs with a stable recipient list and fixed amounts, and evaluate whether it fits within the existing RM-2 roadmap scope or requires a distinct scoping track. (assignee: Product, deadline: None)
  Acceptance criteria: A written record exists confirming the use case details from this feedback, with a note on whether it is covered by the current RM-2 definition or requires scope adjustment — reviewed and signed off by the Product owner.

**Reply draft:**
> Thanks for this — automating a fixed monthly payroll run so your team isn't manually re-uploading the same file every cycle is exactly the kind of workflow improvement that matters for small finance teams. Recurring and scheduled payouts are something we're already tracking as a future capability. You'll see it in our changelog when it ships — [changelog URL placeholder].

---

## CLU-008 — Configurable payout approval workflow for admin-initiated transfers above a threshold
- intent_type: feature_request
- dimension: Product/Roadmap (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-08

**Problem brief:** One customer reports that their current account setup allows any admin to send payouts immediately, with no secondary approval step — creating a financial control gap as their team grows. They need a configurable threshold above which a designated approver (e.g. finance director) must authorize the payout before it is sent.

**Key quotes:**
> any admin can just send it immediately
> Can you add an approval step for payouts above a configurable threshold?

**Source refs:** RM-3

**Tasks:**
- [Low] Document the reported need for a configurable payout approval workflow, capturing the specific use case (finance-director approval required for payouts above a customer-defined dollar threshold, driven by growing team size and financial control requirements), and evaluate whether it fits within the existing RM-3 roadmap scope or requires a distinct scoping track. (assignee: Product, deadline: None)
  Acceptance criteria: A written assessment exists confirming whether this request is subsumed by RM-3 or warrants a separate scope item, with notes on the configurable-threshold and role-targeting details raised in the feedback.

**Reply draft:**
> Thanks for this — a configurable approval threshold tied to specific roles is exactly the kind of financial control that matters as teams scale. We're already tracking approval workflows as a planned capability, and the detail you've shared about per-threshold configuration and finance-director sign-off adds useful specificity. You'll see it in our changelog when it ships — [changelog URL placeholder].

---

## CLU-009 — No memo or reference field on payouts, blocking accounting reconciliation
- intent_type: feature_request
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-09

**Problem brief:** One customer reports that payouts cannot be tagged with an internal reference number or invoice identifier, making it difficult to match transactions against their accounting system. The current payout record surfaces only recipient information, with no structured field for custom metadata.

**Key quotes:**
> attach an internal reference number or memo to each payout (e.g. our own invoice number) so it's easier to match against our accounting system later
> right now there's no way to tag a payout with anything beyond the recipient

**Source refs:** KI-3

**Tasks:**
- [Low] Document the reported need for a memo or reference field on payouts, capturing the reconciliation use case (attaching internal invoice numbers or custom identifiers to individual payout records for accounting matching), and evaluate whether it fits within the existing dashboard and reconciliation roadmap, including whether it complements the known gap in per-line FX cost visibility in exported reports (KI-3). (assignee: Product, deadline: None)
  Acceptance criteria: A written scoping note exists that defines the reconciliation use case, assesses fit with the current payout data model and CSV export, notes any overlap with the FX line-item reporting gap, and records a priority decision.

**Reply draft:**
> Thanks for this — being able to attach your own invoice number or reference to a payout and see it in exports would make reconciliation significantly cleaner, and it's a gap we're aware of on the reporting side. We've logged the request with the product team. You'll see it in our changelog when it ships — [changelog URL placeholder].

---

## CLU-010 — Support replies in English to Spanish-language tickets
- intent_type: complaint
- dimension: Support Process (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-10

**Problem brief:** One customer has reported on two separate occasions that tickets submitted in Spanish received replies written entirely in English, creating a language barrier for the colleague who handles most of their support correspondence. No language detection or routing mechanism appears to be in place to match reply language to submission language.

**Key quotes:**
> I submitted my ticket in Spanish and got a reply entirely in English.
> my colleague who handles most of our tickets doesn't, and this has happened twice now

**Tasks:**
- [Medium] Investigate whether support tooling has language detection or language-routing capabilities, and audit the two prior Spanish-language tickets to confirm they received English-only replies and identify the agents or automation responsible. (assignee: Support Operations, deadline: None)
  Acceptance criteria: Written summary identifying whether language mismatch was caused by agent discretion, automation, or absence of any routing rule; includes ticket IDs of the two affected interactions.
- [Medium] Define and implement a language-matching policy for inbound ticket replies — either by configuring automatic language detection and routing in the support platform, or by establishing an agent guideline requiring replies to match the language of the submission. (assignee: Support Operations, deadline: None)
  Acceptance criteria: A documented policy or configured routing rule is in place; at least one Spanish-language test ticket is handled end-to-end in Spanish without manual escalation.

**Reply draft:**
> Receiving a reply in a different language from the one you wrote in isn't the experience you should have had — and the fact that it's happened twice makes it a process gap we need to fix, not just a one-off. We're reviewing how our team handles language matching for inbound tickets and will put a consistent approach in place. In the meantime, if you or your colleague submit any tickets in Spanish, please note that preference in the subject line and our team will ensure the reply is in Spanish.

**Review flags:**
- needs_human_review: The interim workaround suggested in reply_draft (noting language preference in the subject line) should be verified against current support tooling and agent capacity before it is promised to the customer. (blocks: reply_draft)

**Quality flags:**
- non_english_feedback: Cluster contains feedback referencing Spanish. Verify whether reply_draft should be in the same language before sending.

---

## CLU-011 — Card transaction currency label mismatch in dashboard display
- intent_type: actionable_bug
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-11

**Problem brief:** One customer reported that a card purchase made in EUR is displayed in the dashboard transaction list with a USD currency label but the raw EUR amount as the number, with no conversion applied in the display layer. The underlying balance charge appears correct, but the mislabeled currency causes the running total to appear incorrect at a glance.

**Key quotes:**
> the dashboard transaction list shows it labeled as USD with the EUR amount as the number (no conversion applied in the display)
> makes the running total look wrong at a glance, even though the actual charge to our balance seems correct

**Tasks:**
- [Medium] Investigate the currency label rendering logic for card transactions in the dashboard transaction list — specifically reproduce the condition where a EUR card purchase is displayed with a USD label and the unconverted EUR figure, identify whether the root cause is in the currency metadata returned by the card processor, the display mapping layer, or the transaction record itself, and document the scope of affected transactions and accounts. (assignee: Engineering, deadline: None)
  Acceptance criteria: Written root-cause summary identifying the exact component responsible for the mislabeled currency field, the conditions that trigger it, and the number of affected transaction records, reviewed and signed off by Product.
- [Medium] Review the Engineering root-cause summary, assess whether the currency label mismatch affects reported balances or exported reconciliation data beyond the display layer, determine fix priority and scope, and authorize the approach before any changes are made to transaction display logic. (assignee: Product, deadline: None)
  Acceptance criteria: Written priority decision and fix authorization on record, including explicit confirmation of whether the issue is display-only or whether it affects balance totals or CSV export data.

**Reply draft:**
> Your EUR card transaction is showing a USD label with the raw EUR figure in the transaction list — that's a display bug, not a miscalculation. The actual charge to your balance is correct.

We're investigating the root cause now. We'll follow up once we have a confirmed fix timeline and can tell you whether any other transactions on your account are affected by the same label mismatch.

**Review flags:**
- needs_human_review: The reply asserts that the underlying balance charge is correct based solely on the customer's own observation in the feedback. Before sending, a support agent should verify against the actual transaction record for this account to confirm no balance or conversion error exists alongside the display bug. (blocks: reply_draft)

---

## CLU-012 — Card dispute SLA breached — no update after 12 days
- intent_type: complaint
- dimension: Support Process (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-12

**Problem brief:** One customer submitted a card transaction dispute that has remained in 'under review' status for 12 days without any communication, breaching the 5-business-day review window stated in policy. The dispute was submitted via the dashboard as required, but no resolution or update has been provided.

**Key quotes:**
> Your policy says disputes are reviewed within 5 business days — it's now been more than double that.
> Dashboard still shows 'under review'.

**Source refs:** SP-4

**Tasks:**
- [High] Locate the dispute submitted under ticket #59014, determine its current internal status, identify why it has not been resolved or updated within the 5-business-day window, and document the root cause (e.g. queue failure, missing escalation, partner delay, process gap). (assignee: Support Operations, deadline: OVERDUE — immediate review required)
  Acceptance criteria: Current dispute status confirmed, root cause of SLA breach documented, and a resolution timeline or outcome established — reviewed and signed off by a Support Operations lead.
- [Medium] Based on the Support Operations finding, assess whether the dispute SLA breach reflects a systemic process failure or a one-off case, and determine whether dispute queue monitoring or escalation triggers need to be added to prevent recurrence. (assignee: Product, deadline: None)
  Acceptance criteria: Written determination on scope (isolated vs. systemic), with a documented decision on whether a process or tooling change is required and what form it would take.

**Reply draft:**
> Your dispute has been waiting 12 days with no update — that's beyond our 5-business-day review window and not acceptable. We're treating this as overdue and escalating it for immediate review now. We'll follow up with a status update or resolution as soon as we have confirmed information from the review team — no later than end of next business day.

**Review flags:**
- needs_human_review: The reply commits to a follow-up timeline and implies an imminent resolution or status update. A Support Operations agent must first confirm the actual current state of this dispute before the reply is sent — if the dispute is still genuinely unresolved with no ETA, the promised follow-up timeline in the reply may need to be adjusted. (blocks: reply_draft)

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft

---

## CLU-013 — Transaction history export capped at 90 days, blocking full-year accounting reconciliation
- intent_type: feature_request
- dimension: Finance & Reporting (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-13

**Problem brief:** One customer reports that the transaction history export is limited to a 90-day window, requiring four to five separate exports to cover a full 12-month period for year-end accounting. There is no current roadmap item addressing extended date-range exports, though the gap aligns with broader reconciliation friction already noted in KI-3.

**Key quotes:**
> we can only go back 90 days at a time
> currently we'd have to do this in 4-5 separate exports and stitch them together

**Source refs:** KI-3

**Tasks:**
- [Low] Document the reported need for extended transaction history exports (specifically a full 12-month date range in a single export), capturing the year-end accounting use case and the current 90-day cap limitation, and evaluate whether this fits within the existing dashboard reconciliation and CSV export surface or warrants a new roadmap item alongside KI-3 remediation work. (assignee: Product, deadline: None)
  Acceptance criteria: A written product note exists capturing the use case, the current technical constraint, and a documented decision on whether to add this to the reconciliation roadmap — reviewable by the Support Operations lead.

**Reply draft:**
> Thanks for flagging this — needing to run four or five separate exports just to cover a full year is real friction for year-end accounting, and the value of a single 12-month export is clear.

We've logged this with the product team. In the meantime, the 90-day export does work in segments — if it helps, pulling four consecutive 90-day windows will cover a full year without overlap. You'll see any update on this in our changelog when it ships — [changelog URL placeholder].

---

## CLU-014 — KYB threshold reached without advance notice, causing payout hold
- intent_type: complaint
- dimension: Compliance (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-14

**Problem brief:** One customer hit the $1,000 cumulative payout threshold (SP-6) without prior warning, triggering a KYB requirement that immediately placed their payouts on hold. The platform does not currently surface proactive alerts before a business approaches the KYB threshold, leaving customers unprepared to gather required documentation.

**Key quotes:**
> suddenly we're being asked to complete a full KYB process with documents we don't have ready (registration certs, etc.)
> It would've been really helpful to get a heads-up before we hit that limit so we could prepare.

**Source refs:** SP-6, SP-11

**Tasks:**
- [High] Review this customer's account to confirm their current payout hold status, verify that the KYB trigger was applied correctly per SP-6, and confirm whether their payouts will resume automatically once KYB is approved — then inform the support agent handling this ticket of the outcome so they can set accurate expectations with the customer. (assignee: Support Operations, deadline: URGENT — set by reviewer)
  Acceptance criteria: Account state confirmed (hold status, trigger correctness, and post-KYB resume behavior documented); support agent briefed with specific details before reply is sent to customer.
- [Medium] Investigate the feasibility of adding a proactive threshold-proximity alert — for example, a dashboard notification or email when a business reaches 70–80% of the $1,000 KYB threshold — so customers have time to prepare documentation before payouts are blocked. Document the current threshold-enforcement flow, the touchpoints where an alert could be inserted, and the estimated effort required. (assignee: Product, deadline: None)
  Acceptance criteria: Written summary of current enforcement flow, identified alert insertion points, and a documented effort estimate reviewed and prioritized by Product lead.

**Reply draft:**
> Your payouts being put on hold without any advance warning isn't the experience you should have had — hitting a compliance threshold with no time to prepare documentation is a real operational problem, and we hear that.

Here's where things stand: once your KYB is complete, your payouts will resume. To submit your documents securely, please use our secure document portal (accessible from within your account dashboard) — do not send documents by email. If you're unsure which documents are required or where to find the portal, reply here and we'll walk you through it step by step.

We're also looking into whether we can surface a warning before businesses reach this threshold, so others aren't caught off guard the same way.

**Review flags:**
- needs_human_review: The reply_draft states that payouts will resume once KYB is complete, but this assertion has not been verified against this specific account's hold state. Support Operations must confirm the hold was triggered correctly per SP-6 and that approval will release the hold before this reply is sent. (blocks: reply_draft)

**Quality flags:**
- tone_violation: first sentence of reply_draft does not reference transaction/amount/timing

---

## CLU-015 — Onboarding email not delivered after account activation
- intent_type: actionable_bug
- dimension: Support Process (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-15

**Problem brief:** One customer reported that after signing up, no welcome or onboarding email was received, leaving them unaware their account was active until a login attempt revealed it. The absence of a delivery confirmation mechanism means users cannot distinguish between a failed signup and a silent email delivery failure.

**Key quotes:**
> we signed up about a week ago but never got any onboarding/welcome email
> we almost gave up thinking the signup hadn't gone through

**Tasks:**
- [High] Investigate whether the onboarding/welcome email failed to send or was silently dropped for this account — check email delivery logs, spam filtering, and whether the issue is isolated or affects a broader cohort of recent signups. Document root cause and scope of affected accounts. (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written root-cause summary identifying whether failure is account-specific or systemic, with list of any other affected accounts, reviewed and acknowledged by Product.
- [High] Review Engineering's findings and determine whether a fix to the email delivery pipeline is warranted, and whether affected accounts should receive a retroactive onboarding email or direct outreach. Authorize fix scope and any proactive support action. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written priority decision and fix authorization on record, including explicit decision on whether retroactive onboarding communication should be sent to affected accounts.

**Reply draft:**
> Your account is active — no action is needed on your end to reinstate it. We're sorry the onboarding email didn't reach you; going through signup without any confirmation isn't the experience you should have had. We're looking into what caused the delivery failure and will follow up once we have a clear answer.

**Review flags:**
- needs_human_review: Engineering investigation must confirm whether the email delivery failure is isolated to this account or affects other recent signups before the reply or any proactive outreach is finalized. Reply should not be sent until account state is verified. (blocks: reply_draft)

---

## CLU-016 — Admin account locked out due to lost 2FA device with payroll batch due imminently
- intent_type: actionable_bug
- dimension: Support Process (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-16

**Problem brief:** One customer lost their phone containing their 2FA authenticator app and is fully locked out of the company's primary admin account. Without access, they cannot send a scheduled payroll batch, creating an urgent operational blocker with a hard external deadline.

**Key quotes:**
> I'm locked out of our company's primary admin account — lost my phone with the 2FA app on it last night.
> We have payroll due tomorrow morning and I can't access the account at all to send the batch.

**Source refs:** SP-10, SP-11

**Tasks:**
- [High] Initiate manual account recovery verification for the locked-out primary admin account per the standard recovery process. Confirm the customer's identity and company ownership through the secure document portal — do not accept identity materials via email. Prioritize given the stated payroll deadline. (assignee: Support Operations, deadline: URGENT — set by reviewer)
  Acceptance criteria: Customer's identity verified, 2FA reset completed, and admin account access restored — or customer notified of verified completion ETA no later than close of next business day.
- [Medium] Investigate whether the account recovery flow surfaces a clear, discoverable path for primary admin lockout scenarios (e.g. lost 2FA device), and whether recovery SLA expectations are communicated in-product before a lockout occurs. Document findings for Product review. (assignee: Engineering, deadline: None)
  Acceptance criteria: Written summary of current recovery entry points, where (if anywhere) the 2-business-day SLA is communicated to users, and any gaps identified — delivered to Product for prioritization decision.
- [Medium] Review Engineering's findings on admin lockout recovery discoverability and decide whether improving the in-product guidance or recovery initiation flow warrants prioritization in the near-term roadmap. (assignee: Product, deadline: None)
  Acceptance criteria: Written prioritization decision on record, with rationale, referencing Engineering's root-cause summary.

**Reply draft:**
> We understand this puts you in a difficult position with payroll due tomorrow — here's what needs to happen to restore your access.

Account recovery for a lost 2FA device requires manual verification by our support team, which can take up to 2 business days. Given your payroll deadline, we're treating this as urgent. To start the process immediately, submit your identity and company verification materials through our secure document portal — a link is [SECURE PORTAL LINK]. Do not send documents via email.

Once we receive your materials, we'll work to complete verification as quickly as the process allows and confirm your restored access directly on this ticket.

**Review flags:**
- needs_human_review: The reply references a recovery timeline of 'up to 2 business days' (per SP-10), but the customer's payroll deadline may fall within or before that window. A human agent must assess whether expedited handling is feasible and must not send the reply without confirming the support team's current capacity to prioritize this case. The reply should not be sent if the timeline cannot be met. (blocks: reply_draft)

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft

---

## CLU-017 — Positive feedback: fast KYB onboarding and clean dashboard experience
- intent_type: praise
- dimension: Other/Uncategorized (2), Support Process (1), UX (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-17, FB-18, FB-19, FB-25

**Problem brief:** Four customers submitted unsolicited praise covering three distinct areas: dashboard clarity, support responsiveness, and KYB onboarding speed. No action is required to resolve a problem, but the signal is worth routing to the relevant product and support teams as qualitative evidence of what is working well.

**Key quotes:**
> the KYB approval was much faster than we expected — submitted Tuesday, approved by Wednesday afternoon
> Setup took maybe 15 minutes start to finish, including KYB.

**Reply draft:**
> Thank you for taking the time to share this — it means a lot to hear that the experience landed well. We'll make sure your feedback reaches the teams who built it.

**Review flags:**
- needs_human_review: This cluster has four members who praised different specific features (dashboard design, card limit support, KYB speed, onboarding flow). The reply_draft uses a general acknowledgment to avoid misattributing praise, but each recipient's version should be checked to confirm the wording is appropriate for what that individual actually said before sending. (blocks: reply_draft)

---

## CLU-018 — Out-of-scope product enquiry and vague UX dissatisfaction — no actionable signal
- intent_type: noise
- dimension: Other/Uncategorized (2)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-20, FB-21

**Problem brief:** Two feedback items were received containing no actionable product or operational issue: one asks whether Vela Pay supports Apple Pay (a consumer payment feature outside the B2B product scope), and the other expresses generalised dissatisfaction with the app without identifying a specific problem. Neither item provides enough information to investigate, prioritise, or route to a product or engineering team.

---

## CLU-019 — SMS 2FA codes not delivered for two users on same mobile carrier
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: High
- confidence: High
- cluster_members: FB-22

**Problem brief:** Two team members on the same mobile carrier have been unable to receive SMS 2FA codes since the week of the ticket submission, leaving them locked out of their accounts. All other team members on different carriers are unaffected, suggesting a carrier-specific delivery issue rather than a platform-wide authentication failure.

**Key quotes:**
> Two of our team members (both on the same mobile carrier) stopped receiving 2FA codes via SMS this week
> codes for everyone else arrive fine

**Source refs:** SP-10

**Tasks:**
- [High] Investigate whether SMS 2FA delivery failures are occurring for users on a specific mobile carrier — review delivery logs for the affected accounts (Ticket #59288), identify whether the issue is carrier-side, gateway-side, or a platform routing failure, and document the scope of affected accounts across the platform. (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written root-cause summary identifying the failure point (carrier, SMS gateway, or platform routing), scope of affected users, and whether the issue is isolated to this carrier or broader — reviewed and signed off by Product.
- [High] Review the Engineering root-cause finding, determine whether an alternative 2FA delivery method (e.g. authenticator app) can be offered as an immediate workaround for affected users, and authorize the fix scope and approach. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written priority decision on record, fix approach authorized, and decision made on whether to surface an alternative 2FA method to carrier-affected users as an interim measure.

**Reply draft:**
> We're sorry two of your team members are locked out — SMS codes not arriving for a specific carrier group is not expected behavior, and we're treating this as a priority issue.

We're investigating the delivery failure now to identify whether this is on our end or with the carrier. In the meantime, if either affected user has access to a recovery method (such as a backup code), they should use that to log in. If they're fully locked out with no backup access, our support team can initiate manual account recovery, which takes up to 2 business days to complete — reply here to confirm if that's needed for either account and we'll start the process.

**Review flags:**
- needs_human_review: The reply references the SP-10 manual account recovery process (up to 2 business days) and implicitly commits support effort. A human agent must confirm whether the affected users qualify for manual recovery under SP-10 and verify the carrier delivery failure is not a wider platform incident before the reply is sent. (blocks: reply_draft)

---

## CLU-020 — FX spread displayed post-confirmation differs from rate shown at confirmation
- intent_type: actionable_bug
- dimension: Engineering (1)
- signal_strength: Medium
- confidence: High
- cluster_members: FB-23

**Problem brief:** One customer reports that the FX spread shown in transaction details for reference VP-100442 is approximately 0.3% higher than the rate displayed at the confirmation screen, contradicting the policy that the confirmed spread is final. The discrepancy may indicate a display bug, a data-rendering error in transaction history, or — more seriously — a genuine post-confirmation rate change that would constitute a policy breach.

**Key quotes:**
> the spread shown was different from what I confirmed — about 0.3% higher
> It shouldn't change after I've already confirmed it, right?

**Source refs:** SP-8

**Tasks:**
- [High] Investigate transaction VP-100442 to determine whether the spread applied at settlement matches the rate shown at confirmation, and establish whether the discrepancy is a display/rendering bug in transaction history or reflects an actual post-confirmation rate change. Document the root cause, the scope of affected transactions (i.e. whether other transactions show the same symptom), and the delta in absolute dollar terms for this specific transaction. (assignee: Engineering, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written root-cause summary distinguishing display bug from actual rate change, with scope of affected transactions identified and reviewed by Product; confirmation of whether the spread applied to VP-100442 matches the confirmed rate on record.
- [High] Review Engineering's root-cause findings for VP-100442, assess whether a policy breach under the confirmed-rate guarantee has occurred, determine the appropriate remediation for the affected customer and any others, and authorize fix scope and approach before Engineering proceeds with any changes. (assignee: Product, deadline: URGENT — set by reviewer)
  Acceptance criteria: Written priority decision and fix authorization on record, including explicit ruling on whether a rate correction or customer credit is owed and whether the issue requires proactive outreach to other affected customers.

**Reply draft:**
> We're looking into transaction VP-100442 now. The rate shown at confirmation is the rate that should apply — it does not change after you confirm, and if the figure in your transaction details differs from your confirmation screenshot, that needs to be corrected.

We'll review the transaction record and come back to you with a clear answer on what happened and whether any adjustment is owed. We'll follow up as soon as the investigation is complete — we don't have a precise timeframe yet, but we won't leave this open.

**Review flags:**
- needs_human_review: The reply implies a potential rate correction or credit may be owed to this customer. Before sending, a human reviewer must confirm: (1) whether the spread on VP-100442 actually differs from the confirmed rate or is a display artifact, and (2) whether any financial adjustment is warranted. Sending the draft before this is established could create an implicit commitment to a remedy that may not apply. (blocks: reply_draft)

**Quality flags:**
- ambiguous_timestamp: relative time expression detected in problem_brief/key_quotes/reply_draft

---

## CLU-021 — Dashboard dark mode requested for after-hours reconciliation use
- intent_type: feature_request
- dimension: UX (1)
- signal_strength: Low
- confidence: High
- cluster_members: FB-24

**Problem brief:** One customer has requested a dark mode option for the Vela Pay dashboard, citing eye strain during late-night reconciliation work. This is a UI preference feature with no current roadmap entry.

**Key quotes:**
> easier on the eyes for late-night reconciliation sessions

**Tasks:**
- [Low] Document the reported need for a dashboard dark mode, capturing the late-night reconciliation use case described in the feedback, and evaluate whether it fits within the current product roadmap or UI component system as a low-effort theming addition. (assignee: Product, deadline: None)
  Acceptance criteria: A written scoping note exists that records the request, assesses feasibility within the current design system, and records a priority decision from the Product team.

**Reply draft:**
> Thanks for this — late-night reconciliation is a real workflow, and a dark mode option would make the dashboard noticeably easier to use in those sessions. We've noted the request with our product team. You'll see it in our changelog when it ships — [changelog URL placeholder].

---

## CLU-022 — Multi-entity account management: single login and consolidated reporting across subsidiaries
- intent_type: feature_request
- dimension: Product/Roadmap (2)
- signal_strength: High
- confidence: High
- cluster_members: FB-28, FB-29

**Problem brief:** Two customers report that managing multiple legal entities on Vela Pay requires separate logins per account, with no consolidated view across entities. This is a known gap acknowledged on the roadmap (RM-1) and falls outside the v1 scope of multi-entity or subsidiary account structures.

**Key quotes:**
> manage all of them under a single login with consolidated reporting
> there's no way to see a combined view across them

**Source refs:** RM-1

**Tasks:**
- [Medium] Document the reported need for multi-entity account management, capturing the specific use cases described (multiple subsidiary logins, no consolidated reporting across legal entities, finance team access across a corporate group), and evaluate whether the scope and priority align with the existing RM-1 roadmap item or warrant a refinement of its requirements. (assignee: Product, deadline: None)
  Acceptance criteria: A written scoping note is added to the RM-1 roadmap item (or a linked discovery document) confirming whether these two reports are covered by the current RM-1 definition, and identifying any requirements gaps (e.g. consolidated reporting as a distinct sub-feature). Reviewed and signed off by a Product lead.

**Reply draft:**
> Thanks for this — managing several legal entities through a single login with a consolidated view is exactly the kind of workflow that finance teams running multi-entity groups need. We're aware of this gap and it's on our roadmap. We can't share a delivery date yet, but you'll see it in our changelog when it ships — [changelog URL placeholder].

**Review flags:**
- needs_human_review: This is a multi-member cluster and the reply_draft is a template. Before sending, confirm that neither customer has been given a private roadmap commitment, early-access promise, or timeline estimate through a prior support or sales interaction that would conflict with the 'no delivery date' stance in the reply. (blocks: reply_draft)

---
