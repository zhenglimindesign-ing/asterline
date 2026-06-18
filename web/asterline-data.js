// Asterline — pipeline + work pack dataset. Synthetic Vela Pay data, real eval process.
// Source of truth: pipeline/output/workpacks-v1.md (22 work packs, generate-v9).

export const PIPELINE = [
  { key: "redact",   n: "01", name: "PII redaction",          one: "Personal identifiers are stripped before anything else happens to the text." },
  { key: "intent",   n: "02", name: "Intent classification",  one: "Each item is sorted into one of five types: actionable bug, feature request, complaint, praise, or noise." },
  { key: "tag",      n: "03", name: "Dimension + severity",   one: "Classified items get tagged with which team owns the issue and how severe it is." },
  { key: "cluster",  n: "04", name: "Clustering",             one: "Items describing the same underlying issue are grouped, even across different accounts and different wording." },
  { key: "score",    n: "05", name: "Signal-strength scoring", one: "Each cluster gets a strength score computed from member count, account diversity, and severity." },
  { key: "generate", n: "06", name: "Work pack generation",   one: "One work pack is generated per cluster — the actual artifact a human reviews." },
  { key: "check",    n: "07", name: "Runtime checks",         one: "The same rubric used offline runs live against each work pack before it's shown." },
  { key: "export",   n: "08", name: "Export",                 one: "Finished work packs export as Markdown for people and JSON shaped for Jira or Linear." },
];

export const INTENTS = {
  actionable_bug:  { label: "actionable bug",  marker: "circle"   },
  feature_request: { label: "feature request", marker: "triangle" },
  complaint:       { label: "complaint",       marker: "square"   },
  praise:          { label: "praise",          marker: "plus"     },
  noise:           { label: "noise",           marker: "dash"     },
};

// Raw feedback excerpts used in the landing "problem & value" beat and the Product input preview.
export const RAW_DEMO = [
  { id: "FB-01", channel: "support_ticket", acct: "ACC-2071", text: "Tried to upload our payroll CSV (about 620 rows) and the page just sat there — no error, no confirmation, page just sat there for 10+ minutes. Had to split it into smaller files to get it through." },
  { id: "FB-26", channel: "support_ticket", acct: "ACC-3140", text: "Batch upload for ~700 supplier payments never completed. We had no way of knowing whether the payments had gone out, so we cancelled and resubmitted in chunks." },
  { id: "FB-27", channel: "support_ticket", acct: "ACC-1188", text: "Uploaded a 540-row file, nothing happened. Eventually split it into two and both went fine. Is there a size limit nobody told us about?" },
  { id: "FB-03", channel: "nps_comment",    acct: "ACC-2071", text: "Would love a webhook (or API polling endpoint) when a payout moves between statuses (pending/sent/completed/failed) so we can update our internal systems automatically instead of checking the dashboard manually." },
  { id: "FB-17", channel: "app_review",     acct: "ACC-0420", text: "Clean, no-nonsense dashboard. KYB approval was much faster than we expected — submitted Tuesday, approved by Wednesday afternoon." },
  { id: "FB-20", channel: "app_review",     acct: "ACC-5532", text: "Quick q, not urgent — any plans to support Apple Pay? Just curious." },
];

// Helper to build a task
const t = (p, team, text, acc) => ({ p, team, text, acc: acc || null });

export const CLUSTERS = [
  {
    id: "CLU-001",
    title: "Batch CSV upload silently fails with no error message above 500-row limit",
    intent: "actionable_bug", dimension: "Engineering", signal: "High", confidence: "High",
    members: ["FB-01","FB-26","FB-27"],
    brief: "Three customers attempted batch payout uploads of 620, 540, and 700 rows respectively and received no error message or confirmation — the upload simply hung indefinitely, forcing each to manually split their files and resubmit, costing significant operational time. This is a documented platform limitation (KI-1) with a known 500-row threshold, but the absence of any in-product error message means customers cannot self-diagnose or apply the workaround without external support.",
    quotes: [
      { text: "no error, no confirmation, page just sat there for 10+ minutes", ref: "FB-01" },
      { text: "We had no way of knowing whether the payments had gone out.", ref: "FB-27" }
    ],
    refs: ["KI-1"],
    tasks: [
    { p: "High", team: "Engineering", text: "Investigate the silent failure behavior on CSV batch uploads exceeding 500 rows — confirm the exact row threshold, identify why no validation error or user-facing message is surfaced when the limit is breached, and document the root cause and scope of affected upload attempts.", acc: "Written root-cause summary identifying the specific failure mode (e.g. missing input validation, silent timeout, absent error-handling path), confirmed row threshold, and list of any affected accounts where uploads may have appeared to complete but did not — reviewed and signed off by Product.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Product", text: "Review the Engineering root-cause summary for the silent batch upload failure, determine fix priority relative to current roadmap, and authorize the fix scope — specifically whether to implement a client-side row-count validation with a clear error message, a server-side rejection with an explicit response, or both.", acc: "Written priority decision and fix authorization on record, including the approved error-message text and the validation layer(s) to be targeted, before Engineering proceeds to implementation.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Engineering", text: "Implement the authorized input validation fix so that batch CSV uploads exceeding the row limit are immediately rejected with a clear, specific error message stating the limit and directing the user to split their file.", acc: "Uploading a CSV with more than 500 rows produces a visible, specific error message (e.g. 'This file contains [N] rows — the maximum per upload is 500. Please split your file and resubmit.') within the normal page response time; no silent hang or spinner-without-feedback behavior occurs; verified by QA with files at 499, 500, 501, and 700+ rows.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "We're sorry your batch upload hung with no error message — that's not acceptable behavior, and we understand it cost your team real time to diagnose and work around.\n\nThe platform currently has a 500-row limit per CSV upload, and right now it fails silently when that limit is exceeded rather than telling you what went wrong. Splitting into files of 500 rows or fewer will get your batches through in the meantime.\n\nWe've raised a fix to surface a clear error message when the limit is hit so this is self-diagnosable going forward. You'll see the change noted in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [
    { text: "This reply is a template across three separate customers (FB-01, FB-26, FB-27). Before sending, each version must be verified against the recipient's account to confirm whether any of the oversized upload attempts resulted in partial or duplicate payment execution — if any payments were sent or funds were debited despite the apparent hang, the reply must be revised to address that specific account state before it is sent." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-002",
    title: "Pre-confirmation payout amount mismatches post-debit amount — undisclosed FX charge",
    intent: "actionable_bug", dimension: "Finance & Reporting", signal: "Medium", confidence: "High",
    members: ["FB-02"],
    brief: "One customer reports that the dashboard displayed $5,000.00 before confirming a payout, but their bank statement shows a debit of $5,012.40, with the $12.40 difference not itemized anywhere in the dashboard or confirmation flow. This directly conflicts with Vela Pay's policy that the FX spread is disclosed to the user before transaction confirmation, and aligns with the known issue that the exportable CSV report buries FX costs in the total rather than showing them as a separate line item.",
    quotes: [
      { text: "The dashboard showed our payout as $5,000.00 before confirmation, but our bank statement shows we were debited $5,012.40.", ref: "FB-02" },
      { text: "The extra $12.40 isn't itemized anywhere — is this an FX adjustment? If so it should be shown before we confirm, not discovered afterward.", ref: "FB-02" }
    ],
    refs: ["SP-8","KI-3"],
    tasks: [
    { p: "High", team: "Engineering", text: "Investigate whether the pre-confirmation amount displayed to this customer failed to include the FX conversion fee, determine whether this is an isolated display bug or a systemic failure in the confirmation flow's fee disclosure, and document the root cause with the specific transaction path affected (payout amount, destination country, conversion pair).", acc: "Written root-cause summary identifying whether the $12.40 discrepancy represents an undisclosed FX spread, a fee applied post-confirmation in violation of SP-8, or a display rendering error — reviewed and signed off by Product before any customer communication about the specific amount.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Product", text: "Review the Engineering root-cause finding, assess whether SP-8 was violated for this transaction (and potentially others), determine the scope of affected accounts, authorize the fix approach for the confirmation screen's fee disclosure, and decide whether affected customers are owed a remediation action.", acc: "Written priority decision on record that specifies: (1) whether this is a confirmed SP-8 violation, (2) the estimated number of affected transactions, (3) authorized fix scope for Engineering, and (4) whether a customer remediation process should be initiated.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "The amount shown at confirmation should match what gets debited — a $12.40 difference appearing only on your bank statement, with no itemization in the dashboard, is not how this should work, and we're investigating it now.\n\nWe're looking into whether the conversion fee was applied after confirmation rather than disclosed before it, as it should be. We can't confirm the specific cause or the correct amount until that review is complete, so we won't speculate on the $12.40 here. Once our investigation is done, we'll follow up with a clear explanation of the charge and what happens next — including whether any adjustment is owed.",
    noReply: false,
    reviewFlags: [
    { text: "The reply references the specific dollar amounts ($5,000.00 and $12.40) from the customer's account. Before sending, a support agent must verify the actual transaction record to confirm the discrepancy is real, determine whether SP-8 was violated (fee applied post-confirmation), and establish whether a refund or adjustment is owed. The reply deliberately avoids committing to an outcome — but the mention of 'whether any adjustment is owed' must be authorized by Product's review decision before the reply is sent." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-003",
    title: "API/webhook support for real-time payout status updates",
    intent: "feature_request", dimension: "Engineering", signal: "Medium", confidence: "High",
    members: ["FB-03"],
    brief: "One customer is requesting programmatic payout status notifications — either via webhook callbacks or a polling API endpoint — covering state transitions such as pending, sent, completed, and failed. This capability does not currently exist in v1; finance teams must check the dashboard manually to track payout outcomes, which creates friction for customers who maintain their own internal systems.",
    quotes: [
      { text: "webhook (or API polling endpoint) when a payout moves between statuses (pending/sent/completed/failed)", ref: "FB-03" },
      { text: "update our internal systems automatically instead of checking the dashboard manually", ref: "FB-03" }
    ],
    refs: ["RM-2"],
    tasks: [
    { p: "Medium", team: "Product", text: "Document the reported need for payout status webhooks and API polling, capturing the specific state transitions requested (pending/sent/completed/failed) and the integration use case (syncing internal systems without dashboard polling), and evaluate whether this fits within the existing roadmap or should be scoped as a distinct API surface item alongside RM-2 scheduled payouts work.", acc: "A written product note exists capturing the request details, the frequency of demand relative to other roadmap items, and a documented decision on whether to open a formal scoping workstream or defer — reviewed and signed off by the product owner.", deadline: null }
    ],
    reply: "Thanks for this — knowing exactly when a payout changes state without having to check the dashboard is a real workflow win, especially for teams keeping internal systems in sync. We don't have webhook or API status callbacks available today, but this is the kind of integration capability we're tracking as the platform matures. You'll see it in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [

    ],
    qualityFlags: [
    { type: "ambiguous_timestamp", text: "relative time expression detected in problem_brief/key_quotes/reply_draft" }
    ],
  },
  {
    id: "CLU-004",
    title: "Mobile app session expires too frequently, forcing repeated full login and 2FA",
    intent: "actionable_bug", dimension: "Engineering", signal: "Medium", confidence: "High",
    members: ["FB-04"],
    brief: "One customer reports the mobile app logs them out every few days, requiring a full login and 2FA re-authentication each time. No known issue or documented session-timeout policy covers this behavior, so it is unclear whether this is an intentional session length, a token expiry bug, or a device-specific fault.",
    quotes: [
      { text: "Logs me out every couple of days and I have to go through the full login + 2FA flow again", ref: "FB-04" },
      { text: "Annoying when I just want to quickly check a balance", ref: "FB-04" }
    ],
    refs: [],
    tasks: [
    { p: "Medium", team: "Engineering", text: "Investigate the mobile app session management behavior — reproduce the reported logout cycle, determine whether sessions are expiring prematurely due to a bug (e.g. token refresh failure, incorrect TTL configuration) or per an intentional policy, and document the root cause including any affected session types or device configurations.", acc: "Written root-cause summary identifying whether logout frequency is a defect or intended behavior, including affected scope (e.g. iOS/Android, specific app versions), reviewed and signed off by Product.", deadline: null },
    { p: "Medium", team: "Product", text: "Review the Engineering root-cause finding, determine the intended session lifetime policy for the mobile app, and authorize a fix or configuration change if the current behavior deviates from it. If the session length is intentional, confirm whether UX guidance or in-app messaging should be added to set expectations.", acc: "Written priority decision on record: either fix authorized with defined acceptance behavior (e.g. session persists for X days under normal use), or documented rationale that current behavior is intentional plus a decision on any UX mitigation.", deadline: null }
    ],
    reply: "Your app is logging you out every few days — that's more frequent than it should be, and we're looking into what's causing it. We'll investigate the session behavior and follow up once we have a clear answer on whether this is a bug or something we need to adjust.",
    noReply: false,
    reviewFlags: [
    { text: "No session timeout policy or known issue exists in the reference documents to confirm whether this logout frequency is a bug or intended behavior. The reply_draft makes an implicit commitment that the behavior is wrong — a reviewer should confirm this before sending." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-005",
    title: "Off-ramp payout delay exceeding stated 1–3 business day window — contractor payment outstanding",
    intent: "actionable_bug", dimension: "Support Process", signal: "High", confidence: "High",
    members: ["FB-05"],
    brief: "A payout sent via transaction VP-994821 has not been received by the contractor recipient after 6 business days, breaching the 1–3 business day typical resolution window stated in support policy. The recipient is located in a country that may be among those currently experiencing extended partner bank processing delays per KI-4, which can stretch to approximately 7 days.",
    quotes: [
      { text: "We sent a payout to one of our contractors 6 days ago and they still haven't received the funds.", ref: "FB-05" },
      { text: "This is a payroll payment and the contractor (based in [Country A]) is messaging us asking what's going on", ref: "FB-05" }
    ],
    refs: ["SP-3","KI-4"],
    tasks: [
    { p: "High", team: "Support Operations", text: "Investigate transaction VP-994821: confirm the payout reached the off-ramp partner, identify the current hold point, determine whether the recipient's country is among those listed under KI-4 as experiencing extended partner bank delays, and document a root-cause summary including current status and expected resolution window.", acc: "Written status update on VP-994821 confirming: (1) whether funds cleared Vela Pay's system, (2) which partner bank or off-ramp leg is holding the delay, (3) whether the recipient country is a KI-4-affected destination, and (4) a realistic resolution estimate based on current partner status — reviewed and signed off before reply_draft is sent to the customer.", deadline: "OVERDUE — immediate review required" },
    { p: "High", team: "Product", text: "Review the Support Operations finding for VP-994821 and determine whether this delay constitutes a Vela Pay or partner-side failure, assess whether escalation to the off-ramp partner is warranted, and authorize the appropriate response path — including whether a goodwill gesture or expedited escalation track applies given the payroll-critical nature of the payment.", acc: "Written decision on record covering: (1) failure classification (Vela Pay system vs. partner bank), (2) whether partner escalation is being initiated, (3) any applicable goodwill or remediation action authorized, and (4) the customer-facing timeline commitment that can be included in the reply.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "We're sorry your contractor hasn't received this payment — a payout sitting undelivered after 6 days is outside the window you should expect, and we understand this is putting you in a difficult position with your contractor.\n\nWe're looking into transaction VP-994821 now to identify exactly where the delay is. A small number of destinations are currently experiencing longer-than-usual processing times through local banking partners, which may be a factor here — but we need to confirm the specifics before giving you a reliable timeline.\n\nWe'll follow up with a status update and a concrete expected delivery window as soon as we've confirmed the current position with our partner — we're treating this as urgent.",
    noReply: false,
    reviewFlags: [
    { text: "The reply_draft does not yet include a specific resolution timeline because the Support Operations investigation (task 1) has not been completed. Sending this reply before confirming whether VP-994821 is stuck at the off-ramp partner — and whether the recipient country is KI-4-affected — risks either under- or over-committing on timing for an active payroll payment. The reply must be updated with a confirmed timeline from the investigation before it is sent." }
    ],
    qualityFlags: [
    { type: "ambiguous_timestamp", text: "relative time expression detected in problem_brief/key_quotes/reply_draft" }
    ],
  },
  {
    id: "CLU-006",
    title: "Recipient name mismatch between confirmation screen and bank transfer record",
    intent: "actionable_bug", dimension: "Engineering", signal: "High", confidence: "High",
    members: ["FB-06"],
    brief: "One customer reports that the name displayed on the payout confirmation screen ('J. Okafor') differed from the name transmitted to the recipient's bank ('J. Okefor'), causing the recipient's bank to flag the transfer and delay deposit by two days. The root cause — whether the confirmation screen is pulling from a different data source than the field sent to the payment rail — is unknown and requires engineering investigation.",
    quotes: [
      { text: "The confirmation screen showed the recipient name as 'J. Okafor' but the actual transfer that landed in their bank shows a different spelling ('J. Okefor')", ref: "FB-06" },
      { text: "Where does the confirmation screen pull the name from?", ref: "FB-06" }
    ],
    refs: [],
    tasks: [
    { p: "High", team: "Engineering", text: "Investigate the data pipeline for recipient name display on the confirmation screen versus the name transmitted to the payment rail. Determine whether the confirmation screen reads from a different field, data layer, or transformation step than the value sent downstream, reproduce the mismatch using the affected transaction, and document the root cause including scope of potentially affected transactions.", acc: "Written root-cause summary identifying the specific point of divergence between the displayed name and the transmitted name, with scope assessment (isolated incident vs. systemic), reviewed and signed off by Product.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Product", text: "Review the Engineering root-cause finding, assess whether the name mismatch represents a systemic data integrity issue or an isolated edge case, and authorize the fix scope and approach — including whether affected senders should be proactively notified.", acc: "Written priority decision and fix authorization on record, with a documented stance on customer communication scope.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "Your payout confirmation showed one spelling of the recipient's name while the transfer reached their bank under a different spelling — that discrepancy should not happen, and we're sorry it caused a two-day delay on their end.\n\nWe're investigating where the name shown on the confirmation screen diverges from what gets sent to the bank. Once we have a root-cause answer we'll follow up with what happened and what we're doing to prevent it.",
    noReply: false,
    reviewFlags: [
    { text: "The reply implicitly acknowledges a system error on Vela Pay's part (name data mismatch). Before sending, confirm via the transaction record for ticket #58620 whether the mismatch originated in Vela Pay's system or was present in the recipient details as entered by the sender — this affects both the apology framing and any applicable policy (SP-1 vs. SP-2)." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-007",
    title: "No recurring or scheduled payout support — manual CSV re-upload required each cycle",
    intent: "feature_request", dimension: "Product/Roadmap", signal: "Medium", confidence: "High",
    members: ["FB-07"],
    brief: "One customer reports that running monthly payroll requires re-uploading the same CSV every cycle, with no option to schedule or automate repeat payouts for a fixed recipient/amount list. This is a known roadmap gap: scheduled and recurring payouts are not yet supported in v1.",
    quotes: [
      { text: "we have to re-upload the same CSV every single month for payroll", ref: "FB-07" },
      { text: "A 'repeat monthly' option, even just for a fixed list of recipients/amounts, would be huge for small teams like ours", ref: "FB-07" }
    ],
    refs: ["RM-2"],
    tasks: [
    { p: "Low", team: "Product", text: "Document the reported need for recurring/scheduled payouts, capturing the specific use case of fixed monthly payroll runs with a stable recipient list and fixed amounts, and evaluate whether it fits within the existing RM-2 roadmap scope or requires a distinct scoping track.", acc: "A written record exists confirming the use case details from this feedback, with a note on whether it is covered by the current RM-2 definition or requires scope adjustment — reviewed and signed off by the Product owner.", deadline: null }
    ],
    reply: "Thanks for this — automating a fixed monthly payroll run so your team isn't manually re-uploading the same file every cycle is exactly the kind of workflow improvement that matters for small finance teams. Recurring and scheduled payouts are something we're already tracking as a future capability. You'll see it in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [

    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-008",
    title: "Configurable payout approval workflow for admin-initiated transfers above a threshold",
    intent: "feature_request", dimension: "Product/Roadmap", signal: "Medium", confidence: "High",
    members: ["FB-08"],
    brief: "One customer reports that their current account setup allows any admin to send payouts immediately, with no secondary approval step — creating a financial control gap as their team grows. They need a configurable threshold above which a designated approver (e.g. finance director) must authorize the payout before it is sent.",
    quotes: [
      { text: "any admin can just send it immediately", ref: "FB-08" },
      { text: "Can you add an approval step for payouts above a configurable threshold?", ref: "FB-08" }
    ],
    refs: ["RM-3"],
    tasks: [
    { p: "Low", team: "Product", text: "Document the reported need for a configurable payout approval workflow, capturing the specific use case (finance-director approval required for payouts above a customer-defined dollar threshold, driven by growing team size and financial control requirements), and evaluate whether it fits within the existing RM-3 roadmap scope or requires a distinct scoping track.", acc: "A written assessment exists confirming whether this request is subsumed by RM-3 or warrants a separate scope item, with notes on the configurable-threshold and role-targeting details raised in the feedback.", deadline: null }
    ],
    reply: "Thanks for this — a configurable approval threshold tied to specific roles is exactly the kind of financial control that matters as teams scale. We're already tracking approval workflows as a planned capability, and the detail you've shared about per-threshold configuration and finance-director sign-off adds useful specificity. You'll see it in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [

    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-009",
    title: "No memo or reference field on payouts, blocking accounting reconciliation",
    intent: "feature_request", dimension: "Finance & Reporting", signal: "Medium", confidence: "High",
    members: ["FB-09"],
    brief: "One customer reports that payouts cannot be tagged with an internal reference number or invoice identifier, making it difficult to match transactions against their accounting system. The current payout record surfaces only recipient information, with no structured field for custom metadata.",
    quotes: [
      { text: "attach an internal reference number or memo to each payout (e.g. our own invoice number) so it's easier to match against our accounting system later", ref: "FB-09" },
      { text: "right now there's no way to tag a payout with anything beyond the recipient", ref: "FB-09" }
    ],
    refs: ["KI-3"],
    tasks: [
    { p: "Low", team: "Product", text: "Document the reported need for a memo or reference field on payouts, capturing the reconciliation use case (attaching internal invoice numbers or custom identifiers to individual payout records for accounting matching), and evaluate whether it fits within the existing dashboard and reconciliation roadmap, including whether it complements the known gap in per-line FX cost visibility in exported reports (KI-3).", acc: "A written scoping note exists that defines the reconciliation use case, assesses fit with the current payout data model and CSV export, notes any overlap with the FX line-item reporting gap, and records a priority decision.", deadline: null }
    ],
    reply: "Thanks for this — being able to attach your own invoice number or reference to a payout and see it in exports would make reconciliation significantly cleaner, and it's a gap we're aware of on the reporting side. We've logged the request with the product team. You'll see it in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [

    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-010",
    title: "Support replies in English to Spanish-language tickets",
    intent: "complaint", dimension: "Support Process", signal: "Medium", confidence: "High",
    members: ["FB-10"],
    brief: "One customer has reported on two separate occasions that tickets submitted in Spanish received replies written entirely in English, creating a language barrier for the colleague who handles most of their support correspondence. No language detection or routing mechanism appears to be in place to match reply language to submission language.",
    quotes: [
      { text: "I submitted my ticket in Spanish and got a reply entirely in English.", ref: "FB-10" },
      { text: "my colleague who handles most of our tickets doesn't, and this has happened twice now", ref: "FB-10" }
    ],
    refs: [],
    tasks: [
    { p: "Medium", team: "Support Operations", text: "Investigate whether support tooling has language detection or language-routing capabilities, and audit the two prior Spanish-language tickets to confirm they received English-only replies and identify the agents or automation responsible.", acc: "Written summary identifying whether language mismatch was caused by agent discretion, automation, or absence of any routing rule; includes ticket IDs of the two affected interactions.", deadline: null },
    { p: "Medium", team: "Support Operations", text: "Define and implement a language-matching policy for inbound ticket replies — either by configuring automatic language detection and routing in the support platform, or by establishing an agent guideline requiring replies to match the language of the submission.", acc: "A documented policy or configured routing rule is in place; at least one Spanish-language test ticket is handled end-to-end in Spanish without manual escalation.", deadline: null }
    ],
    reply: "Receiving a reply in a different language from the one you wrote in isn't the experience you should have had — and the fact that it's happened twice makes it a process gap we need to fix, not just a one-off. We're reviewing how our team handles language matching for inbound tickets and will put a consistent approach in place. In the meantime, if you or your colleague submit any tickets in Spanish, please note that preference in the subject line and our team will ensure the reply is in Spanish.",
    noReply: false,
    reviewFlags: [
    { text: "The interim workaround suggested in reply_draft (noting language preference in the subject line) should be verified against current support tooling and agent capacity before it is promised to the customer." }
    ],
    qualityFlags: [
    { type: "non_english_feedback", text: "Cluster contains feedback referencing Spanish. Verify whether reply_draft should be in the same language before sending." }
    ],
  },
  {
    id: "CLU-011",
    title: "Card transaction currency label mismatch in dashboard display",
    intent: "actionable_bug", dimension: "Finance & Reporting", signal: "Medium", confidence: "High",
    members: ["FB-11"],
    brief: "One customer reported that a card purchase made in EUR is displayed in the dashboard transaction list with a USD currency label but the raw EUR amount as the number, with no conversion applied in the display layer. The underlying balance charge appears correct, but the mislabeled currency causes the running total to appear incorrect at a glance.",
    quotes: [
      { text: "the dashboard transaction list shows it labeled as USD with the EUR amount as the number (no conversion applied in the display)", ref: "FB-11" },
      { text: "makes the running total look wrong at a glance, even though the actual charge to our balance seems correct", ref: "FB-11" }
    ],
    refs: [],
    tasks: [
    { p: "Medium", team: "Engineering", text: "Investigate the currency label rendering logic for card transactions in the dashboard transaction list — specifically reproduce the condition where a EUR card purchase is displayed with a USD label and the unconverted EUR figure, identify whether the root cause is in the currency metadata returned by the card processor, the display mapping layer, or the transaction record itself, and document the scope of affected transactions and accounts.", acc: "Written root-cause summary identifying the exact component responsible for the mislabeled currency field, the conditions that trigger it, and the number of affected transaction records, reviewed and signed off by Product.", deadline: null },
    { p: "Medium", team: "Product", text: "Review the Engineering root-cause summary, assess whether the currency label mismatch affects reported balances or exported reconciliation data beyond the display layer, determine fix priority and scope, and authorize the approach before any changes are made to transaction display logic.", acc: "Written priority decision and fix authorization on record, including explicit confirmation of whether the issue is display-only or whether it affects balance totals or CSV export data.", deadline: null }
    ],
    reply: "Your EUR card transaction is showing a USD label with the raw EUR figure in the transaction list — that's a display bug, not a miscalculation. The actual charge to your balance is correct.\n\nWe're investigating the root cause now. We'll follow up once we have a confirmed fix timeline and can tell you whether any other transactions on your account are affected by the same label mismatch.",
    noReply: false,
    reviewFlags: [
    { text: "The reply asserts that the underlying balance charge is correct based solely on the customer's own observation in the feedback. Before sending, a support agent should verify against the actual transaction record for this account to confirm no balance or conversion error exists alongside the display bug." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-012",
    title: "Card dispute SLA breached — no update after 12 days",
    intent: "complaint", dimension: "Support Process", signal: "High", confidence: "High",
    members: ["FB-12"],
    brief: "One customer submitted a card transaction dispute that has remained in 'under review' status for 12 days without any communication, breaching the 5-business-day review window stated in policy. The dispute was submitted via the dashboard as required, but no resolution or update has been provided.",
    quotes: [
      { text: "Your policy says disputes are reviewed within 5 business days — it's now been more than double that.", ref: "FB-12" },
      { text: "Dashboard still shows 'under review'.", ref: "FB-12" }
    ],
    refs: ["SP-4"],
    tasks: [
    { p: "High", team: "Support Operations", text: "Locate the dispute submitted under ticket #59014, determine its current internal status, identify why it has not been resolved or updated within the 5-business-day window, and document the root cause (e.g. queue failure, missing escalation, partner delay, process gap).", acc: "Current dispute status confirmed, root cause of SLA breach documented, and a resolution timeline or outcome established — reviewed and signed off by a Support Operations lead.", deadline: "OVERDUE — immediate review required" },
    { p: "Medium", team: "Product", text: "Based on the Support Operations finding, assess whether the dispute SLA breach reflects a systemic process failure or a one-off case, and determine whether dispute queue monitoring or escalation triggers need to be added to prevent recurrence.", acc: "Written determination on scope (isolated vs. systemic), with a documented decision on whether a process or tooling change is required and what form it would take.", deadline: null }
    ],
    reply: "Your dispute has been waiting 12 days with no update — that's beyond our 5-business-day review window and not acceptable. We're treating this as overdue and escalating it for immediate review now. We'll follow up with a status update or resolution as soon as we have confirmed information from the review team — no later than end of next business day.",
    noReply: false,
    reviewFlags: [
    { text: "The reply commits to a follow-up timeline and implies an imminent resolution or status update. A Support Operations agent must first confirm the actual current state of this dispute before the reply is sent — if the dispute is still genuinely unresolved with no ETA, the promised follow-up timeline in the reply may need to be adjusted." }
    ],
    qualityFlags: [
    { type: "ambiguous_timestamp", text: "relative time expression detected in problem_brief/key_quotes/reply_draft" }
    ],
  },
  {
    id: "CLU-013",
    title: "Transaction history export capped at 90 days, blocking full-year accounting reconciliation",
    intent: "feature_request", dimension: "Finance & Reporting", signal: "Medium", confidence: "High",
    members: ["FB-13"],
    brief: "One customer reports that the transaction history export is limited to a 90-day window, requiring four to five separate exports to cover a full 12-month period for year-end accounting. There is no current roadmap item addressing extended date-range exports, though the gap aligns with broader reconciliation friction already noted in KI-3.",
    quotes: [
      { text: "we can only go back 90 days at a time", ref: "FB-13" },
      { text: "currently we'd have to do this in 4-5 separate exports and stitch them together", ref: "FB-13" }
    ],
    refs: ["KI-3"],
    tasks: [
    { p: "Low", team: "Product", text: "Document the reported need for extended transaction history exports (specifically a full 12-month date range in a single export), capturing the year-end accounting use case and the current 90-day cap limitation, and evaluate whether this fits within the existing dashboard reconciliation and CSV export surface or warrants a new roadmap item alongside KI-3 remediation work.", acc: "A written product note exists capturing the use case, the current technical constraint, and a documented decision on whether to add this to the reconciliation roadmap — reviewable by the Support Operations lead.", deadline: null }
    ],
    reply: "Thanks for flagging this — needing to run four or five separate exports just to cover a full year is real friction for year-end accounting, and the value of a single 12-month export is clear.\n\nWe've logged this with the product team. In the meantime, the 90-day export does work in segments — if it helps, pulling four consecutive 90-day windows will cover a full year without overlap. You'll see any update on this in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [

    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-014",
    title: "KYB threshold reached without advance notice, causing payout hold",
    intent: "complaint", dimension: "Compliance", signal: "High", confidence: "High",
    members: ["FB-14"],
    brief: "One customer hit the $1,000 cumulative payout threshold (SP-6) without prior warning, triggering a KYB requirement that immediately placed their payouts on hold. The platform does not currently surface proactive alerts before a business approaches the KYB threshold, leaving customers unprepared to gather required documentation.",
    quotes: [
      { text: "suddenly we're being asked to complete a full KYB process with documents we don't have ready (registration certs, etc.)", ref: "FB-14" },
      { text: "It would've been really helpful to get a heads-up before we hit that limit so we could prepare.", ref: "FB-14" }
    ],
    refs: ["SP-6","SP-11"],
    tasks: [
    { p: "High", team: "Support Operations", text: "Review this customer's account to confirm their current payout hold status, verify that the KYB trigger was applied correctly per SP-6, and confirm whether their payouts will resume automatically once KYB is approved — then inform the support agent handling this ticket of the outcome so they can set accurate expectations with the customer.", acc: "Account state confirmed (hold status, trigger correctness, and post-KYB resume behavior documented); support agent briefed with specific details before reply is sent to customer.", deadline: "URGENT — set by reviewer" },
    { p: "Medium", team: "Product", text: "Investigate the feasibility of adding a proactive threshold-proximity alert — for example, a dashboard notification or email when a business reaches 70–80% of the $1,000 KYB threshold — so customers have time to prepare documentation before payouts are blocked. Document the current threshold-enforcement flow, the touchpoints where an alert could be inserted, and the estimated effort required.", acc: "Written summary of current enforcement flow, identified alert insertion points, and a documented effort estimate reviewed and prioritized by Product lead.", deadline: null }
    ],
    reply: "Your payouts being put on hold without any advance warning isn't the experience you should have had — hitting a compliance threshold with no time to prepare documentation is a real operational problem, and we hear that.\n\nHere's where things stand: once your KYB is complete, your payouts will resume. To submit your documents securely, please use our secure document portal (accessible from within your account dashboard) — do not send documents by email. If you're unsure which documents are required or where to find the portal, reply here and we'll walk you through it step by step.\n\nWe're also looking into whether we can surface a warning before businesses reach this threshold, so others aren't caught off guard the same way.",
    noReply: false,
    reviewFlags: [
    { text: "The reply_draft states that payouts will resume once KYB is complete, but this assertion has not been verified against this specific account's hold state. Support Operations must confirm the hold was triggered correctly per SP-6 and that approval will release the hold before this reply is sent." }
    ],
    qualityFlags: [
    { type: "tone_violation", text: "first sentence of reply_draft does not reference transaction/amount/timing" }
    ],
  },
  {
    id: "CLU-015",
    title: "Onboarding email not delivered after account activation",
    intent: "actionable_bug", dimension: "Support Process", signal: "Medium", confidence: "High",
    members: ["FB-15"],
    brief: "One customer reported that after signing up, no welcome or onboarding email was received, leaving them unaware their account was active until a login attempt revealed it. The absence of a delivery confirmation mechanism means users cannot distinguish between a failed signup and a silent email delivery failure.",
    quotes: [
      { text: "we signed up about a week ago but never got any onboarding/welcome email", ref: "FB-15" },
      { text: "we almost gave up thinking the signup hadn't gone through", ref: "FB-15" }
    ],
    refs: [],
    tasks: [
    { p: "High", team: "Engineering", text: "Investigate whether the onboarding/welcome email failed to send or was silently dropped for this account — check email delivery logs, spam filtering, and whether the issue is isolated or affects a broader cohort of recent signups. Document root cause and scope of affected accounts.", acc: "Written root-cause summary identifying whether failure is account-specific or systemic, with list of any other affected accounts, reviewed and acknowledged by Product.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Product", text: "Review Engineering's findings and determine whether a fix to the email delivery pipeline is warranted, and whether affected accounts should receive a retroactive onboarding email or direct outreach. Authorize fix scope and any proactive support action.", acc: "Written priority decision and fix authorization on record, including explicit decision on whether retroactive onboarding communication should be sent to affected accounts.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "Your account is active — no action is needed on your end to reinstate it. We're sorry the onboarding email didn't reach you; going through signup without any confirmation isn't the experience you should have had. We're looking into what caused the delivery failure and will follow up once we have a clear answer.",
    noReply: false,
    reviewFlags: [
    { text: "Engineering investigation must confirm whether the email delivery failure is isolated to this account or affects other recent signups before the reply or any proactive outreach is finalized. Reply should not be sent until account state is verified." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-016",
    title: "Admin account locked out due to lost 2FA device with payroll batch due imminently",
    intent: "actionable_bug", dimension: "Support Process", signal: "High", confidence: "High",
    members: ["FB-16"],
    brief: "One customer lost their phone containing their 2FA authenticator app and is fully locked out of the company's primary admin account. Without access, they cannot send a scheduled payroll batch, creating an urgent operational blocker with a hard external deadline.",
    quotes: [
      { text: "I'm locked out of our company's primary admin account — lost my phone with the 2FA app on it last night.", ref: "FB-16" },
      { text: "We have payroll due tomorrow morning and I can't access the account at all to send the batch.", ref: "FB-16" }
    ],
    refs: ["SP-10","SP-11"],
    tasks: [
    { p: "High", team: "Support Operations", text: "Initiate manual account recovery verification for the locked-out primary admin account per the standard recovery process. Confirm the customer's identity and company ownership through the secure document portal — do not accept identity materials via email. Prioritize given the stated payroll deadline.", acc: "Customer's identity verified, 2FA reset completed, and admin account access restored — or customer notified of verified completion ETA no later than close of next business day.", deadline: "URGENT — set by reviewer" },
    { p: "Medium", team: "Engineering", text: "Investigate whether the account recovery flow surfaces a clear, discoverable path for primary admin lockout scenarios (e.g. lost 2FA device), and whether recovery SLA expectations are communicated in-product before a lockout occurs. Document findings for Product review.", acc: "Written summary of current recovery entry points, where (if anywhere) the 2-business-day SLA is communicated to users, and any gaps identified — delivered to Product for prioritization decision.", deadline: null },
    { p: "Medium", team: "Product", text: "Review Engineering's findings on admin lockout recovery discoverability and decide whether improving the in-product guidance or recovery initiation flow warrants prioritization in the near-term roadmap.", acc: "Written prioritization decision on record, with rationale, referencing Engineering's root-cause summary.", deadline: null }
    ],
    reply: "We understand this puts you in a difficult position with payroll due tomorrow — here's what needs to happen to restore your access.\n\nAccount recovery for a lost 2FA device requires manual verification by our support team, which can take up to 2 business days. Given your payroll deadline, we're treating this as urgent. To start the process immediately, submit your identity and company verification materials through our secure document portal — a link is [SECURE PORTAL LINK]. Do not send documents via email.\n\nOnce we receive your materials, we'll work to complete verification as quickly as the process allows and confirm your restored access directly on this ticket.",
    noReply: false,
    reviewFlags: [
    { text: "The reply references a recovery timeline of 'up to 2 business days' (per SP-10), but the customer's payroll deadline may fall within or before that window. A human agent must assess whether expedited handling is feasible and must not send the reply without confirming the support team's current capacity to prioritize this case. The reply should not be sent if the timeline cannot be met." }
    ],
    qualityFlags: [
    { type: "ambiguous_timestamp", text: "relative time expression detected in problem_brief/key_quotes/reply_draft" }
    ],
  },
  {
    id: "CLU-017",
    title: "Positive feedback: fast KYB onboarding and clean dashboard experience",
    intent: "praise", dimension: "Other/Uncategorized", signal: "High", confidence: "High",
    members: ["FB-17","FB-18","FB-19","FB-25"],
    brief: "Four customers submitted unsolicited praise covering three distinct areas: dashboard clarity, support responsiveness, and KYB onboarding speed. No action is required to resolve a problem, but the signal is worth routing to the relevant product and support teams as qualitative evidence of what is working well.",
    quotes: [
      { text: "the KYB approval was much faster than we expected — submitted Tuesday, approved by Wednesday afternoon", ref: "FB-19" },
      { text: "Setup took maybe 15 minutes start to finish, including KYB.", ref: "FB-25" }
    ],
    refs: [],
    tasks: [

    ],
    reply: "Thank you for taking the time to share this — it means a lot to hear that the experience landed well. We'll make sure your feedback reaches the teams who built it.",
    noReply: false,
    reviewFlags: [
    { text: "This cluster has four members who praised different specific features (dashboard design, card limit support, KYB speed, onboarding flow). The reply_draft uses a general acknowledgment to avoid misattributing praise, but each recipient's version should be checked to confirm the wording is appropriate for what that individual actually said before sending." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-018",
    title: "Out-of-scope product enquiry and vague UX dissatisfaction — no actionable signal",
    intent: "noise", dimension: "Other/Uncategorized", signal: "Medium", confidence: "High",
    members: ["FB-20","FB-21"],
    brief: "Two feedback items were received containing no actionable product or operational issue: one asks whether Vela Pay supports Apple Pay (a consumer payment feature outside the B2B product scope), and the other expresses generalised dissatisfaction with the app without identifying a specific problem. Neither item provides enough information to investigate, prioritise, or route to a product or engineering team.",
    quotes: [
      
    ],
    refs: [],
    tasks: [

    ],
    reply: null,
    noReply: true,
    reviewFlags: [

    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-019",
    title: "SMS 2FA codes not delivered for two users on same mobile carrier",
    intent: "actionable_bug", dimension: "Engineering", signal: "High", confidence: "High",
    members: ["FB-22"],
    brief: "Two team members on the same mobile carrier have been unable to receive SMS 2FA codes since the week of the ticket submission, leaving them locked out of their accounts. All other team members on different carriers are unaffected, suggesting a carrier-specific delivery issue rather than a platform-wide authentication failure.",
    quotes: [
      { text: "Two of our team members (both on the same mobile carrier) stopped receiving 2FA codes via SMS this week", ref: "FB-22" },
      { text: "codes for everyone else arrive fine", ref: "FB-22" }
    ],
    refs: ["SP-10"],
    tasks: [
    { p: "High", team: "Engineering", text: "Investigate whether SMS 2FA delivery failures are occurring for users on a specific mobile carrier — review delivery logs for the affected accounts (Ticket #59288), identify whether the issue is carrier-side, gateway-side, or a platform routing failure, and document the scope of affected accounts across the platform.", acc: "Written root-cause summary identifying the failure point (carrier, SMS gateway, or platform routing), scope of affected users, and whether the issue is isolated to this carrier or broader — reviewed and signed off by Product.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Product", text: "Review the Engineering root-cause finding, determine whether an alternative 2FA delivery method (e.g. authenticator app) can be offered as an immediate workaround for affected users, and authorize the fix scope and approach.", acc: "Written priority decision on record, fix approach authorized, and decision made on whether to surface an alternative 2FA method to carrier-affected users as an interim measure.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "We're sorry two of your team members are locked out — SMS codes not arriving for a specific carrier group is not expected behavior, and we're treating this as a priority issue.\n\nWe're investigating the delivery failure now to identify whether this is on our end or with the carrier. In the meantime, if either affected user has access to a recovery method (such as a backup code), they should use that to log in. If they're fully locked out with no backup access, our support team can initiate manual account recovery, which takes up to 2 business days to complete — reply here to confirm if that's needed for either account and we'll start the process.",
    noReply: false,
    reviewFlags: [
    { text: "The reply references the SP-10 manual account recovery process (up to 2 business days) and implicitly commits support effort. A human agent must confirm whether the affected users qualify for manual recovery under SP-10 and verify the carrier delivery failure is not a wider platform incident before the reply is sent." }
    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-020",
    title: "FX spread displayed post-confirmation differs from rate shown at confirmation",
    intent: "actionable_bug", dimension: "Engineering", signal: "Medium", confidence: "High",
    members: ["FB-23"],
    brief: "One customer reports that the FX spread shown in transaction details for reference VP-100442 is approximately 0.3% higher than the rate displayed at the confirmation screen, contradicting the policy that the confirmed spread is final. The discrepancy may indicate a display bug, a data-rendering error in transaction history, or — more seriously — a genuine post-confirmation rate change that would constitute a policy breach.",
    quotes: [
      { text: "the spread shown was different from what I confirmed — about 0.3% higher", ref: "FB-23" },
      { text: "It shouldn't change after I've already confirmed it, right?", ref: "FB-23" }
    ],
    refs: ["SP-8"],
    tasks: [
    { p: "High", team: "Engineering", text: "Investigate transaction VP-100442 to determine whether the spread applied at settlement matches the rate shown at confirmation, and establish whether the discrepancy is a display/rendering bug in transaction history or reflects an actual post-confirmation rate change. Document the root cause, the scope of affected transactions (i.e. whether other transactions show the same symptom), and the delta in absolute dollar terms for this specific transaction.", acc: "Written root-cause summary distinguishing display bug from actual rate change, with scope of affected transactions identified and reviewed by Product; confirmation of whether the spread applied to VP-100442 matches the confirmed rate on record.", deadline: "URGENT — set by reviewer" },
    { p: "High", team: "Product", text: "Review Engineering's root-cause findings for VP-100442, assess whether a policy breach under the confirmed-rate guarantee has occurred, determine the appropriate remediation for the affected customer and any others, and authorize fix scope and approach before Engineering proceeds with any changes.", acc: "Written priority decision and fix authorization on record, including explicit ruling on whether a rate correction or customer credit is owed and whether the issue requires proactive outreach to other affected customers.", deadline: "URGENT — set by reviewer" }
    ],
    reply: "We're looking into transaction VP-100442 now. The rate shown at confirmation is the rate that should apply — it does not change after you confirm, and if the figure in your transaction details differs from your confirmation screenshot, that needs to be corrected.\n\nWe'll review the transaction record and come back to you with a clear answer on what happened and whether any adjustment is owed. We'll follow up as soon as the investigation is complete — we don't have a precise timeframe yet, but we won't leave this open.",
    noReply: false,
    reviewFlags: [
    { text: "The reply implies a potential rate correction or credit may be owed to this customer. Before sending, a human reviewer must confirm: (1) whether the spread on VP-100442 actually differs from the confirmed rate or is a display artifact, and (2) whether any financial adjustment is warranted. Sending the draft before this is established could create an implicit commitment to a remedy that may not apply." }
    ],
    qualityFlags: [
    { type: "ambiguous_timestamp", text: "relative time expression detected in problem_brief/key_quotes/reply_draft" }
    ],
  },
  {
    id: "CLU-021",
    title: "Dashboard dark mode requested for after-hours reconciliation use",
    intent: "feature_request", dimension: "UX", signal: "Low", confidence: "High",
    members: ["FB-24"],
    brief: "One customer has requested a dark mode option for the Vela Pay dashboard, citing eye strain during late-night reconciliation work. This is a UI preference feature with no current roadmap entry.",
    quotes: [
      { text: "easier on the eyes for late-night reconciliation sessions", ref: "FB-24" }
    ],
    refs: [],
    tasks: [
    { p: "Low", team: "Product", text: "Document the reported need for a dashboard dark mode, capturing the late-night reconciliation use case described in the feedback, and evaluate whether it fits within the current product roadmap or UI component system as a low-effort theming addition.", acc: "A written scoping note exists that records the request, assesses feasibility within the current design system, and records a priority decision from the Product team.", deadline: null }
    ],
    reply: "Thanks for this — late-night reconciliation is a real workflow, and a dark mode option would make the dashboard noticeably easier to use in those sessions. We've noted the request with our product team. You'll see it in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [

    ],
    qualityFlags: [

    ],
  },
  {
    id: "CLU-022",
    title: "Multi-entity account management: single login and consolidated reporting across subsidiaries",
    intent: "feature_request", dimension: "Product/Roadmap", signal: "High", confidence: "High",
    members: ["FB-28","FB-29"],
    brief: "Two customers report that managing multiple legal entities on Vela Pay requires separate logins per account, with no consolidated view across entities. This is a known gap acknowledged on the roadmap (RM-1) and falls outside the v1 scope of multi-entity or subsidiary account structures.",
    quotes: [
      { text: "manage all of them under a single login with consolidated reporting", ref: "FB-28" },
      { text: "there's no way to see a combined view across them", ref: "FB-29" }
    ],
    refs: ["RM-1"],
    tasks: [
    { p: "Medium", team: "Product", text: "Document the reported need for multi-entity account management, capturing the specific use cases described (multiple subsidiary logins, no consolidated reporting across legal entities, finance team access across a corporate group), and evaluate whether the scope and priority align with the existing RM-1 roadmap item or warrant a refinement of its requirements.", acc: "A written scoping note is added to the RM-1 roadmap item (or a linked discovery document) confirming whether these two reports are covered by the current RM-1 definition, and identifying any requirements gaps (e.g. consolidated reporting as a distinct sub-feature). Reviewed and signed off by a Product lead.", deadline: null }
    ],
    reply: "Thanks for this — managing several legal entities through a single login with a consolidated view is exactly the kind of workflow that finance teams running multi-entity groups need. We're aware of this gap and it's on our roadmap. We can't share a delivery date yet, but you'll see it in our changelog when it ships — [changelog URL placeholder].",
    noReply: false,
    reviewFlags: [
    { text: "This is a multi-member cluster and the reply_draft is a template. Before sending, confirm that neither customer has been given a private roadmap commitment, early-access promise, or timeline estimate through a prior support or sales interaction that would conflict with the 'no delivery date' stance in the reply." }
    ],
    qualityFlags: [

    ],
  },
];

export const NO_CONTEXT_CLUSTERS = [
  {
    id: "NC-001", title: "App crashes when uploading large attachments", intent: "actionable_bug",
    dimension: "Engineering", signal: "High", confidence: "Medium", members: ["PB-04", "PB-11", "PB-23"],
    brief: "Several reviewers describe the app freezing or crashing when attaching large files. Without product context, the pipeline can group the reports and classify intent, but cannot trace any of it to a known issue or policy clause — there is no context corpus loaded for this run.",
    quotes: [ { text: "crashes every time I attach anything over a few MB", ref: "PB-04" }, { text: "froze and lost everything I'd typed", ref: "PB-23" } ],
    refs: [], tasks: [
      t("High", "Engineering", "Reproduce the crash with large attachments across platforms and capture logs.", null),
      t("Medium", "Engineering", "Add an attachment size guard and a clear error rather than a freeze.", null),
    ],
    reply: "Thanks for flagging the crashes on large attachments — we're able to see the pattern across several reports and are investigating. We don't have a confirmed fix date yet.\n\nNote: this run had no product context loaded, so we can't yet link this to a known issue or confirm scope against internal records.",
    reviewFlags: [], qualityFlags: [],
  },
  {
    id: "NC-002", title: "Requests for a usable offline / poor-connection mode", intent: "feature_request",
    dimension: "Product/Roadmap", signal: "Medium", confidence: "Medium", members: ["PB-07", "PB-19"],
    brief: "Two reviewers ask for the app to remain usable on poor connections. Classified and clustered without any product context — no roadmap document is available to confirm whether this is planned.",
    quotes: [ { text: "useless on the train when signal drops", ref: "PB-07" } ],
    refs: [], tasks: [ t("Medium", "Product", "Scope a minimal offline/queued-action mode and assess demand.", null) ],
    reply: "An offline-tolerant mode is a reasonable ask and we've logged it. With no product context loaded for this run, we can't say whether it's already on a roadmap — that would need the internal documents.",
    reviewFlags: [], qualityFlags: [],
  },
  {
    id: "NC-003", title: "Positive feedback on speed after the latest update", intent: "praise",
    dimension: "Other / UX", signal: "Medium", confidence: "High", members: ["PB-02", "PB-14"],
    brief: "Reviewers note the app feels noticeably faster after a recent update. No action required; surfaced as positive signal. No context corpus was loaded, so no specific product area is attributed.",
    quotes: [ { text: "way snappier since the update", ref: "PB-02" } ],
    refs: [], tasks: [], reply: "Great to hear the recent update feels faster — thanks for taking the time to say so.",
    reviewFlags: [], qualityFlags: [],
  },
  {
    id: "NC-004", title: "Vague one-star reviews with no specific issue", intent: "noise",
    dimension: "Other / Uncategorized", signal: "Low", confidence: "Medium", members: ["PB-09", "PB-30"],
    brief: "Two low-rating reviews with no identifiable feature, flow, or failure. Not enough signal to act on. No reply drafted.",
    quotes: [], refs: [], tasks: [], reply: null, reviewFlags: [], qualityFlags: [], noReply: true,
  },
];

// Real eval numbers from docs/06-iteration-log.md (classification stage, golden set).
export const EVAL = {
  goldenSetSize: 20,
  final: [
    { axis: "intent_type", score: 90 },
    { axis: "dimension",   score: 90 },
    { axis: "impact",      score: 75 },
    { axis: "urgency",     score: 85 },
    { axis: "overall",     score: 65 },
  ],
  // overall match against the golden set, by prompt version
  iteration: [
    { v: "v0", overall: 40, note: "first prompt" },
    { v: "v1", overall: 45, note: "FB-20 noise + FB-09 dimension fixed" },
    { v: "v2", overall: 55, note: "urgency rubric tightened (+15% urgency)" },
    { v: "v3", overall: 50, note: "reverted — impact rule too broad, kept in the log not hidden", reverted: true },
    { v: "v4", overall: 65, note: "few-shot impact examples; FB-03/07/13 fixed" },
  ],
  workpacks: { generated: 22, total: 22, qualityFlags: 7, reviewFlags: 15, flaggedClusters: 5, hardFails: 0 },
};

// Full clause text for every source ref — so a citation is openable, not an opaque token.
// Verbatim from data/01-vela-pay-context-docs.md.
export const CLAUSES = {
  "SP-1": { kind: "Support policy", text: "If a payout fails due to incorrect recipient details provided by the sender, Vela Pay will attempt to reverse the transaction to the sender's balance within 3–5 business days. A reversal fee equal to the original payout fee may apply." },
  "SP-2": { kind: "Support policy", text: "If a payout fails due to a Vela Pay system or partner error (not caused by incorrect recipient details), the full amount is reversed to the sender's balance within 1 business day, with no fee." },
  "SP-3": { kind: "Support policy", text: "Stablecoin-to-fiat off-ramp delays caused by the recipient's local banking partner are outside Vela Pay's direct control. Support can escalate but cannot guarantee a resolution timeline; typical resolution is 1–3 business days." },
  "SP-4": { kind: "Support policy", text: "Cardholders can dispute a transaction within 60 days of the transaction date. Disputes are submitted via the dashboard and reviewed within 5 business days." },
  "SP-5": { kind: "Support policy", text: "Vela Pay does not reverse card transactions that were authorized by the cardholder, even if the cardholder later regrets the purchase (no \"buyer's remorse\" reversals)." },
  "SP-6": { kind: "Support policy", text: "Business accounts must complete KYB before sending or receiving payouts above $1,000 in cumulative volume. Below this threshold, a limited-access account is available with reduced limits." },
  "SP-7": { kind: "Support policy", text: "Individual payout recipients must complete KYC once cumulative receipts exceed $10,000 in a rolling 12-month period. Until then, payouts proceed without additional recipient verification." },
  "SP-8": { kind: "Support policy", text: "The FX spread applied at conversion is shown to the user before confirming the transaction. Vela Pay does not retroactively change the spread on a transaction already confirmed." },
  "SP-9": { kind: "Support policy", text: "Payout fees are charged to the sender. Recipients do not pay a fee to receive funds, regardless of destination country." },
  "SP-10": { kind: "Support policy", text: "If a company's primary admin account is locked out (e.g. lost 2FA device), account recovery requires manual verification by the support team and may take up to 2 business days." },
  "TG-1": { kind: "Tone & voice", text: "Direct, not corporate. Avoid filler phrases (\"We're sorry for any inconvenience this may have caused\"). State what happened and what happens next." },
  "TG-2": { kind: "Tone & voice", text: "Precise about money and time. Never say \"soon\" or \"shortly\" when a specific timeframe is known. If no timeframe is known, say so explicitly rather than guessing." },
  "TG-3": { kind: "Tone & voice", text: "No blame-shifting language toward the user — even when SP-1 applies. Instead of \"you entered the wrong details\": \"The payout failed because the recipient details didn't match — here's how to fix it.\"" },
  "TG-4": { kind: "Tone & voice", text: "Plain language over financial jargon. Avoid \"off-ramp,\" \"settlement,\" \"spread\" in user-facing copy unless the user used the term first." },
  "TG-5": { kind: "Tone & voice", text: "Acknowledge money/timing concerns first. When a reply addresses a delayed or failed payment, the first sentence should address the money/timing question directly — not background or apology." },
  "TG-6": { kind: "Tone & voice", text: "Confident but not overpromising. Don't promise outcomes outside Vela Pay's control (e.g. a partner bank resolving by a specific date — see SP-3)." },
  "KI-1": { kind: "Known issue", text: "Batch payout CSV upload fails silently if the file contains more than 500 rows — no error message is shown, and the upload simply doesn't complete. Workaround: split into batches of ≤500." },
  "KI-2": { kind: "Known issue", text: "Virtual card transaction notifications are sometimes delayed by 10–15 minutes during high-traffic periods (typically UTC evenings), which can cause confusion about whether a transaction went through." },
  "KI-3": { kind: "Known issue", text: "The dashboard's exportable CSV report does not currently include the FX spread as a separate line item — it's baked into the total, making reconciliation harder for finance teams that need to track FX costs separately." },
  "KI-4": { kind: "Known issue", text: "Recipients in a small number of supported countries (currently under review) experience off-ramp delays longer than the typical 1–3 business days referenced in SP-3, sometimes extending to a week, due to partner bank processing times." },
  "RM-1": { kind: "Roadmap — not yet built", text: "Multi-entity / subsidiary account structures — requested by larger SME customers managing multiple legal entities under one parent company." },
  "RM-2": { kind: "Roadmap — not yet built", text: "Scheduled/recurring payouts (e.g. automatic monthly payroll runs without manual re-upload) — currently every payout requires a fresh CSV upload or manual entry." },
  "RM-3": { kind: "Roadmap — not yet built", text: "Role-based approval workflows (e.g. payouts above a threshold require a second admin's approval before sending) — current v1 only has admin/finance/viewer roles without an approval chain." },
  "RM-4": { kind: "Roadmap — not yet built", text: "Non-USD-pegged stablecoin support — requested mainly by customers in regions where USD stablecoins face local regulatory friction." },
};

// Full raw feedback text per item, so a quote opens its original. Verbatim from
// data/02-synthetic-feedback-25.md — PII (emails/phones) is present and redacted at view time.
export const FEEDBACK = {
  "FB-01": { channel: "support ticket", account: "Acme Logistics (ACC-1042)", raw: "Ticket #58213 | Priority: High | Subject: Batch upload silently failing\n\nWe uploaded our payroll CSV (620 rows) this morning at around 9am and nothing happened — no error, no confirmation, page just sat there for 10+ minutes. We ended up splitting it into two files manually to get it through, which took our ops team almost an hour during a busy week.\n\nThis is the SECOND time this has happened to us (first time was back in March, support said it was a \"known limitation\" but we never got a clear number).\n\n— Dana Reyes, Ops Manager, Acme Logistics\ndana.reyes@acmelogistics.com | +1 (415) 555-0142" },
  "FB-02": { channel: "support ticket", account: "Vantage Trading (ACC-9921)", raw: "Ticket #58301 | Priority: Medium | Subject: Dashboard amount doesn't match actual debit\n\nThe dashboard showed our payout as $5,000.00 before confirmation, but our bank statement shows we were debited $5,012.40. The extra $12.40 isn't itemized anywhere — is this an FX adjustment? If so it should be shown before we confirm, not discovered afterward.\n\nReuben Castillo\ntreasury@vantagetrading.com" },
  "FB-03": { channel: "feature request form", account: "Brightline Media (ACC-3387)", raw: "Feature request: webhook/API notifications for payout status\n\nWe'd like to receive a webhook (or API polling endpoint) when a payout moves between statuses (pending/sent/completed/failed), so we can update our internal systems automatically instead of checking the dashboard manually." },
  "FB-04": { channel: "app review", account: "anonymous", raw: "★★☆☆☆ \"Logs me out constantly\"\n\nThe mobile app logs me out every couple of days and I have to go through the full login + 2FA flow again. Annoying when I just want to quickly check a balance." },
  "FB-05": { channel: "support ticket", account: "Meridian Consulting (ACC-2210)", raw: "Ticket #58502 | Priority: Urgent | Subject: Payout still not received after 6 days\n\nWe sent a payout to one of our contractors 6 days ago and they still haven't received the funds. Your policy page says 1-3 business days for off-ramp. This is a payroll payment and the contractor (based in [Country A]) is messaging us asking what's going on — it's getting awkward on our end.\n\nCan someone please look into this today? Transaction ref: VP-994821.\n\nTom Adeyemi\nAccounts Payable, Meridian Consulting\ntom.adeyemi@meridianconsulting.com" },
  "FB-06": { channel: "support ticket", account: "Fieldwork Agency (ACC-7102)", raw: "Ticket #58620 | Priority: High | Subject: Recipient name mismatch on confirmation vs bank record\n\nThe confirmation screen showed the recipient name as \"J. Okafor\" but the actual transfer that landed in their bank shows a different spelling (\"J. Okefor\"), which caused their bank to flag it for review and delay the deposit by 2 days. Where does the confirmation screen pull the name from?\n\nChidi Osei\nops@fieldworkagency.com" },
  "FB-07": { channel: "feature request form", account: "anonymous", raw: "Feature request: Recurring/scheduled payouts\n\nIt would save us so much time if we could set up recurring payouts — right now we have to re-upload the same CSV every single month for payroll. A \"repeat monthly\" option, even just for a fixed list of recipients/amounts, would be huge for small teams like ours." },
  "FB-08": { channel: "support ticket", account: "Northwind Operations (ACC-5519)", raw: "Ticket #58701 | Priority: Low | Subject: Approval workflow for large payouts\n\nWe have a finance director who needs to approve any payout over $5,000 before it goes out, but right now any admin can just send it immediately. As we add more team members this is becoming a real risk for us. Can you add an approval step for payouts above a configurable threshold?\n\n— Submitted via dashboard contact form" },
  "FB-09": { channel: "feature request form", account: "Northwind Operations (ACC-5519)", raw: "Feature request: memo/reference field on payouts\n\nWe'd like to attach an internal reference number or memo to each payout (e.g. our own invoice number) so it's easier to match against our accounting system later — right now there's no way to tag a payout with anything beyond the recipient." },
  "FB-10": { channel: "support ticket", account: "Del Sol Exports (ACC-6034)", raw: "Ticket #58740 | Priority: Low | Subject: Support replied in English to a Spanish-language ticket\n\nI submitted my ticket in Spanish and got a reply entirely in English. Not a huge deal since I read English fine, but my colleague who handles most of our tickets doesn't, and this has happened twice now.\n\nLucia Fernandez\ntreasury@delsolexports.mx" },
  "FB-11": { channel: "support ticket", account: "Harbor Goods (ACC-1187)", raw: "Ticket #58812 | Priority: Medium | Subject: Card transaction shows wrong currency in dashboard\n\nOne of our team's card purchases was made in EUR, but the dashboard transaction list shows it labeled as USD with the EUR amount as the number (no conversion applied in the display) — makes the running total look wrong at a glance, even though the actual charge to our balance seems correct." },
  "FB-12": { channel: "support ticket", account: "Fieldwork Agency (ACC-7102)", raw: "Ticket #59014 | Priority: Medium | Subject: Dispute still \"under review\" after 12 days\n\nI submitted a dispute for a card charge 12 days ago and haven't heard anything back. Dashboard still shows \"under review\". Your policy says disputes are reviewed within 5 business days — it's now been more than double that. Can someone check on this?\n[Screenshot of dispute status attached]\n\nChidi Osei\nc.osei@fieldworkagency.com" },
  "FB-13": { channel: "support ticket", account: "Meridian Consulting (ACC-2210)", raw: "Ticket #59005 | Priority: Low | Subject: Export limited to 90 days\n\nWhen exporting transaction history, it looks like we can only go back 90 days at a time. For our year-end accounting we need a full 12-month export — currently we'd have to do this in 4-5 separate exports and stitch them together." },
  "FB-14": { channel: "email", account: "Little Bay Goods (ACC-8847)", raw: "From: finance@littlebay.co\nTo: support@velapay.com\nSubject: Surprised by KYB requirement\n\nHi, we're a small business and just crossed $1,000 in total payout volume — suddenly we're being asked to complete a full KYB process with documents we don't have ready (registration certs, etc.). It would've been really helpful to get a heads-up before we hit that limit so we could prepare. As it stands, our payouts are now on hold while we scramble.\n\nThanks,\nAmira Hassan\nfinance@littlebay.co" },
  "FB-15": { channel: "email", account: "Little Bay Goods (ACC-8847)", raw: "From: finance@littlebay.co\nTo: support@velapay.com\nSubject: Never received onboarding email\n\nHi, we signed up about a week ago but never got any onboarding/welcome email — we only found out our account was active because someone tried logging in. Is this a known delivery issue? We almost gave up thinking the signup hadn't gone through.\n\nThanks,\nAmira Hassan" },
  "FB-16": { channel: "support ticket", account: "Northwind Operations (ACC-5519)", raw: "Ticket #59140 | Priority: URGENT | Subject: Locked out of admin account — payroll due tomorrow\n\nI'm locked out of our company's primary admin account — lost my phone with the 2FA app on it last night. We have payroll due tomorrow morning and I can't access the account at all to send the batch. What do I need to do to get back in ASAP?\nPlease call me if faster: +44 7700 900123.\n\nSam Whitfield\nadmin@northwindops.com" },
  "FB-17": { channel: "app review", account: "anonymous", raw: "★★★★★ \"Clean, no-nonsense dashboard\"\n\nReally appreciate how uncluttered the dashboard is compared to other fintech tools I've used — everything I need is visible without digging through menus. Whoever designed this, thank you." },
  "FB-18": { channel: "survey response", account: "Harbor Goods (ACC-1187)", raw: "Q: Describe a recent support interaction.\nA: Had a quick question about card limits, got a clear answer within an hour via chat. No back-and-forth needed. Pretty smooth." },
  "FB-19": { channel: "survey response", account: "Vantage Trading (ACC-9921)", raw: "Q: Anything that exceeded expectations during setup?\nA: Honestly the KYB approval was much faster than we expected — submitted Tuesday, approved by Wednesday afternoon. Other providers took us almost two weeks." },
  "FB-20": { channel: "support ticket", account: "anonymous · timestamp missing", raw: "Ticket #59401 | Priority: Low | Subject: (no subject)\n\ndoes this support apple pay? just curious, not urgent" },
  "FB-21": { channel: "app review", account: "anonymous", raw: "★★☆☆☆ \"meh\"\n\nApp is just kind of clunky honestly, not sure what else to say. Could be better." },
  "FB-22": { channel: "support ticket", account: "Acme Logistics (ACC-1042)", raw: "Ticket #59288 | Priority: High | Subject: 2FA codes not arriving via SMS\n\nTwo of our team members (both on the same mobile carrier) stopped receiving 2FA codes via SMS this week — codes for everyone else arrive fine. They're currently unable to log in. Is this a known carrier-specific issue?\n\nDana Reyes\nops@acmelogistics.com" },
  "FB-23": { channel: "support ticket", account: "Del Sol Exports (ACC-6034)", raw: "Ticket #59340 | Priority: Medium | Subject: Spread changed after confirmation?\n\nI confirmed a currency conversion at one rate (screenshot of confirmation attached), but when I checked the transaction details afterward, the spread shown was different from what I confirmed — about 0.3% higher. It's not a huge amount in absolute terms, but it shouldn't change after I've already confirmed it, right? Can someone check this specific transaction (ref VP-100442)?\n\nLucia Fernandez\ntreasury@delsolexports.mx" },
  "FB-24": { channel: "feature request form", account: "anonymous", raw: "Feature request: dark mode\n\nWould love a dark mode for the dashboard — easier on the eyes for late-night reconciliation sessions." },
  "FB-25": { channel: "app review", account: "anonymous", raw: "★★★★★ \"Smooth onboarding\"\n\nSetup took maybe 15 minutes start to finish, including KYB. Way less painful than I expected based on horror stories from other fintech signups." },
  "FB-26": { channel: "support ticket", account: "Cascade Freight (ACC-4456)", raw: "Ticket #60102 | Priority: High | Subject: Can't get our payroll batch to upload\n\nTried running our usual monthly contractor payments through the bulk upload today (just over 540 lines) and it basically froze — spinning for ages, never told us if it worked or not. Ended up chopping the file in half and resubmitting, which finally went through but ate up a chunk of our afternoon. This needs to actually tell us something when it breaks.\n\n— Priya Nair, Finance Lead, Cascade Freight" },
  "FB-27": { channel: "email", account: "Orbit Logix (ACC-7733)", raw: "Subject: Issue with large payment batch\n\nHello, I wanted to flag a problem we ran into this week. We attempted to process a supplier payment run of roughly 700 line items through the platform, and the request appeared to hang indefinitely — no success message, no failure message, nothing. We had no way of knowing whether the payments had gone out. After waiting nearly 20 minutes, we cancelled and resubmitted the list in two smaller groups, which completed without trouble. I'd appreciate understanding whether there's a row limit we should be aware of going forward.\n\nRegards,\nMarcus Webb, Orbit Logix" },
  "FB-28": { channel: "feature request form", account: "Ashgrove Holdings (ACC-3201)", raw: "Feature request: support for multiple subsidiary entities under one parent account\n\nWe manage several subsidiaries and currently have to log into a separate Vela Pay account for each one. It would help a lot if we could manage all of them under a single login with consolidated reporting." },
  "FB-29": { channel: "support ticket", account: "Solway Group (ACC-6688)", raw: "Ticket #60340 | Priority: Low | Subject: One login for multiple business units?\n\nOur finance team has to log into three different Vela Pay accounts to manage our group's different legal entities, and there's no way to see a combined view across them. Is a multi-entity setup something on the roadmap?" },
};

export const REPO_URL = "https://github.com/zhenglimindesign-ing/asterline";
