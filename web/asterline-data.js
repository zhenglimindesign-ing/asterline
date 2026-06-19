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
    id: "NC-001", title: "App crashes or force-closes after recent updates", intent: "actionable_bug",
    dimension: "Engineering", signal: "High", confidence: "Medium", members: ["PB-010", "PB-020", "PB-040", "PB-045", "PB-049"],
    brief: "Five reviewers report the app crashing, force-closing, or becoming unresponsive after a recent update. The pattern is consistent across different devices and use cases. Without product context, the pipeline can group the reports and classify intent, but cannot trace any of it to a known issue or policy clause.",
    quotes: [ { text: "it crashes regularly. it doesn't play videos properly", ref: "PB-010" }, { text: "it only works well in extreme data savings mode", ref: "PB-020" } ],
    refs: [], tasks: [
      t("High", "Engineering", "Reproduce the crash across the reported device/OS combinations and capture stack traces.", null),
      t("Medium", "Engineering", "Investigate whether the latest update introduced a memory or rendering regression.", null),
    ],
    reply: "Thanks for flagging the crashes — we can see a pattern across several reports following the latest update and are investigating. We don't have a confirmed fix date yet.\n\nNote: this run had no product context loaded, so we can't link this to a known issue or confirm scope against internal records.",
    reviewFlags: [], qualityFlags: [],
  },
  {
    id: "NC-002", title: "Push notification delivery failures and delays", intent: "actionable_bug",
    dimension: "Engineering", signal: "Medium", confidence: "Medium", members: ["PB-041", "PB-053", "PB-057"],
    brief: "Three reviewers report push notifications not arriving, arriving late, or re-enabling themselves after being disabled. No product context is loaded to determine whether this is a known platform limitation.",
    quotes: [ { text: "why is my push notifications not appearing! i have 125 people enabled but i only get a tweet for every 5 minutes", ref: "PB-041" } ],
    refs: [], tasks: [ t("Medium", "Engineering", "Audit push notification delivery pipeline for timing and reliability issues.", null) ],
    reply: "Notification delivery problems are frustrating, especially when the settings look correct. We've logged the pattern and are investigating.\n\nNote: no product context was loaded for this run — we can't confirm whether this is a known limitation.",
    reviewFlags: [], qualityFlags: [],
  },
  {
    id: "NC-003", title: "Positive feedback on core experience and reliability", intent: "praise",
    dimension: "Other / UX", signal: "Medium", confidence: "High", members: ["PB-001", "PB-009", "PB-022", "PB-027"],
    brief: "Four reviewers praise the app's core functionality, speed, and ease of use. No action required; surfaced as positive signal. No context corpus was loaded, so no specific product area is attributed.",
    quotes: [ { text: "great internal comms system for our business", ref: "PB-001" }, { text: "brilliant app for browsing and for fb. downloading is fastest", ref: "PB-022" } ],
    refs: [], tasks: [], reply: "Thanks for taking the time to share positive feedback — it means a lot. We'll make sure it reaches the teams who built it.",
    reviewFlags: [], qualityFlags: [],
  },
  {
    id: "NC-004", title: "Vague low-rating reviews with no specific issue", intent: "noise",
    dimension: "Other / Uncategorized", signal: "Low", confidence: "Medium", members: ["PB-051"],
    brief: "A low-rating review with no identifiable feature, flow, or failure beyond general dissatisfaction. Not enough signal to act on. No reply drafted.",
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
// 250 real app-store reviews from a public dataset
// Source: github.com/Hrd2D/Sentiment-analysis-on-Google-Play-store-apps-reviews
export const PUBLIC_REVIEWS = [
  { id: "PB-001", text: "great internal comms system for our business", rating: 4 },
  { id: "PB-002", text: "just one irritating issue very nice app... except one issue.     there is no option of select all for photos inside a folder. i have to select each photo individually. and there is no option to download or make offline the entire folder. one of the above options must be there.", rating: 4 },
  { id: "PB-003", text: "free the gifs not reliable on a slower network,  messages frequently don't send", rating: 1 },
  { id: "PB-004", text: "i wish there is a mute button for selected people. i like it so far but it is more like a skype now. but i hope next update the will be option like mute button where i can mute someone so that i won't recieve any notification from that particular person without deleting the message or blocking them coz that would be so rude if i do that. or option where i can hide the seen or a mark as unread. other than that it is good i liked it, that's all my concern.", rating: 1 },
  { id: "PB-005", text: "not enough space 6g is nothing these days. need at least 32g to store all the memory hungry apps as every update gets bigger and bigger as the quality and functionality get smaller and smaller. please dont go to that material crap !!!  not evertone likes the cheap material design. it is designed for lazy devs who like the easy/lazy way", rating: 1 },
  { id: "PB-006", text: "some problems are solved thank you. feeling good more and more. need to play high quality youtube video. its default quality really worst. new bugs can't download video on facebook.  thanks for introducing play online on facebook. fix it and if i dont find anymore bug sure 5 star.", rating: 5 },
  { id: "PB-007", text: "it is fine.. and getting better.. working quite well for me at the minute. i liked the recent layout changes and messaging facilities. websites links are handled better and able to open in browser as well. the problem with notifications still exists.  i can't tell if someone accepted my connection request or send me an invitation. notifications appear for a second and go away.", rating: 4 },
  { id: "PB-008", text: "buggy. reinstall several times. issues editing uploaded photo from news feed post. only editable via image caption. then image is greyed out on news feed like it's pending photo upload & won't go away. also can't upload photo from phone gallery (share) to albums. have to open fb & upload photo, select from gallery to add to album.", rating: 3 },
  { id: "PB-009", text: "awesome app it is good and very useful app it is very fast in dowload and easy to use anyone can handle it", rating: 5 },
  { id: "PB-010", text: "firefox is getting better ... slowly it crashes regularly. it doesn't play video on youtube. otherwise it is a promising fast browser, i still miss the gestures/swipes and a well organized homepage with my selected bookmarks (see ucbrowser hd)", rating: 1 },
  { id: "PB-011", text: "whatsapp i use this app now that blackberry messenger has basically gone away. my friends & family live all over the world. this really helps keep us in touch!", rating: 5 },
  { id: "PB-012", text: "update uninstalls! everytime i try to update it uninstalls the app! what i want to know is if this is using my data each time i update and then have to reinstall?! driving me crazy. please fix.", rating: 3 },
  { id: "PB-013", text: "fonts why in the heck is this thing analysing my fonts??? not really quick browsing when i have to wait 5minutes for the fonts to load. are you asking my opinion? avoid this. terrible", rating: 3 },
  { id: "PB-014", text: "makes life better evernote has saved my bacon multiple times because i could easily find a picture of my drivers license or info on airline clubs or a receipt i needed.  i used to keep info like that in contacts and it is much more difficult to search for that way and it clogs up your contacts.  plus you can save screenshots, websites, pictures,  anything!  and they are searchable!", rating: 4 },
  { id: "PB-015", text: "connection issues with the version it says can't connect to server. , with error report 1 -1. everytime either connected with cellular data connection or over wifi", rating: 3 },
  { id: "PB-016", text: "samsung galaxy s5 sm-g900f always come back to chrome it just works on so many sites i use, better than the other browsers. but it does need this improved data savings update quick! and the malware blocking which may already be included now, i'm not sure?. more importantly it needs a ad blocker, but obviously this is going to effect google's business model. a chromium download please?", rating: 1 },
  { id: "PB-017", text: "my husband and i can't send msgs to each other. it's saying on both ends that one other ain't receiving msgs at this time.. one messenger we can't recover to see if msgs got blocked . help fix this", rating: 3 },
  { id: "PB-018", text: "developers please read. i think there needs to be some kind of confirmation implemented when the 'buy extra moves for 9 gold bars' button is clicked. i recently didn't do so well on a level and i ran out of moves, when going to press 'end game' , i  pressed the extra moves by accident and it took 9 bars even though i had no intention of continuing. i felt hurt after saving them up for so long. please consider this.", rating: 3 },
  { id: "PB-019", text: "love it but there should be switch off or sign out button having a sign out option helps you maintaining your personal space. you can keep a check on the constant addiction and usage of this service and it can help you in striking a balance between your personal and social life.", rating: 5 },
  { id: "PB-020", text: "keeps crashing it only works well in extreme data savings mode. in high data savings mode it keeps crashing and sometimes websites dont load.please fix this or i am moving to another browser.", rating: 2 },
  { id: "PB-021", text: "can i make phone calls? i don't see anything that shows that i can make regular phone calls. please help.", rating: 1 },
  { id: "PB-022", text: "brilliant app brilliant app for browsing and for fb.downloading is fastest compared to other browsers.one thing it has to improve is that it should be made safer for browsing nd some web pages does not open in this browser.", rating: 4 },
  { id: "PB-023", text: "ads? really? ads in the kantipur app? you guys so down to earn money?", rating: 2 },
  { id: "PB-024", text: "like button the like button, you know the thing that you can actually change now with a sticker(ie snowman) after the update it has never worked on me! i've tried uninstalling and reinstalling and nothing it still don't work", rating: 1 },
  { id: "PB-025", text: "frozen 12/17/15 review of temple run 2..  appropriate for the age of 13 and up... great game without the redicioulous violence... provides sufficient rewards for successful achievements.... ...... you can either turn on or off google play rewards  very easy in temple run settings! !  ....  ..... ..... please click like, if helpful..... .... .... many thanks to their tech support and developers for their great work!!", rating: 4 },
  { id: "PB-026", text: "terrible worst app ever 45 mins trying to back up photos! wont drag and drop from pc or mobile. will only let you highlight 1 at a time! what fool designed this to be easy? maybe it does but its not clear onedrive app so much better and simple! all you want is it to run in background but its a joke!", rating: 3 },
  { id: "PB-027", text: "viber s.a.r.l. this app helps me to stay in contact while also having video options and picture options. really nice app and pretty stable running. just a few video and audio issues as well as video and call drops which can be annoying. sometimes the app is unstable but is mostly attributed to network issues rather than the app itself. i recommend this app.", rating: 4 },
  { id: "PB-028", text: "{•=•} new ui looks good but still laggy and unstable and wtf with ads???????", rating: 1 },
  { id: "PB-029", text: "google chrome app it allows me to browse the internet on a phone of all things. seriously guys we're living in the future. 5 stars because it always works.", rating: 5 },
  { id: "PB-030", text: "refuses to clear history on exit and submitting reports does nothing since i have been reporting this for the last few months. for those of you complaining about crashes, that is probably because you do not have enough internal memory to run firefox properly.", rating: 1 },
  { id: "PB-031", text: "unbelievably bad support by google for their own products.  had to hard reset my android 4.04 tablet and could not reinstall chrome because google no longer supports chrome browser on android 4.0x.  so i had to install a non google browser. i would give a rating of 0 if i could.", rating: 2 },
  { id: "PB-032", text: "emoji đ hey bro, please add more emotions. can emotions be little bit larger in resolution?  your app's assets consist more emoji but are not loading in app. there should be a way to flip to next emoji page.", rating: 5 },
  { id: "PB-033", text: "fraud! i did not select this app to install. it installed automatically. it will not allow me to uninstall. google fix this.  i'll go to the attorney general.  this is not right.", rating: 2 },
  { id: "PB-034", text: "temple run 2 frozen shadows i love this game so much i love being in the ice but only one thing that i hate about it is that the monster goes infront of u when your running but as you go further into the game it gets harder but able to pass the monster", rating: 2 },
  { id: "PB-035", text: "2 big issues 1 . there is no download manager in chrome , when i select save target as , i don't have any control over the download , i can't pause or cancel it after that and most of the times i am unable to download the file .        2 . i can't use two chrome tabs in multi window on note 3 , i can do that in note 5 but it just doesn't work in note 3 . plz fix", rating: 2 },
  { id: "PB-036", text: "why we have to use this? google we think its a time to make some changes in your team. who is planning and making this horrible aps? is apple or microsoft paying you for that?! what's about dark theme for the beginning for this useless app?! and make ability for sending files pls. make everything in one place. we don't need dozen usless aps!", rating: 1 },
  { id: "PB-037", text: "error and only error i think this is the worst app made which doesn't load and mobile gets hang.and full screen ads.and in pdf format many error in spelling.old one was very much better than this.", rating: 1 },
  { id: "PB-038", text: "the new update sucks i hate that they switched favorite to like , i love twitter so much but it's turning into facebook real fast, i previously rated it 5 stars but right now i'm rating it 1 star due to te next update, i'll rate it 5 again once the change is made, until then, if you want a second facebook experience feel free to download.", rating: 1 },
  { id: "PB-039", text: "works great maybe you could do something about the download location. i can't change it to external storage. i don't want the downloads to fill up the phone memory. please do something about that.", rating: 3 },
  { id: "PB-040", text: "you should fix this it does'nt work anymore. i don't know what to do, because everytime i open this app, it automatically closes and a pop up message says: unfortunately, facebook has stopped.", rating: 1 },
  { id: "PB-041", text: "fix it dammit! why is my push notifications not appearing! i have 125 people enabled but i only get a tweet for every 5 minutes instead of all of them at the same time. i reinstalled the app countless times but they don't appear ar all. ive already missed 20 tweets in other 1 minute and i shouldve got notified for them all but i only got 1 for 1 tweet. fix this update im not liking it!", rating: 2 },
  { id: "PB-042", text: "trust worthy as always! have been a long time user of firefox in all my desktops and laptops. now using it on my android phones as well. not settling for any other second rate browser!!", rating: 4 },
  { id: "PB-043", text: "such an awesome game love it a really fun games definitely suggest any reader of this description to get it is so good you will enjoy the game and it doesn't feel like a waste of time afterwards it is very easy to play and it's very fun to find ways to knock down the building just by using one bird thoroughly recommend it it is very fun and you're so good so please download this game will be blessed", rating: 4 },
  { id: "PB-044", text: "issue my dropbox is password protected, but anyone can access my data if he's using my phone. i opened picsart to edit my pics, there was option to open dropbox pics without password. plz fix it", rating: 2 },
  { id: "PB-045", text: "was great i was going to give this 5 stars until the latest update causes it to constantly crash and force close. please fix it! i love playing this game!", rating: 2 },
  { id: "PB-046", text: "now perfect, with animated gif support", rating: 4 },
  { id: "PB-047", text: "no stickers!!!! why is there no stickers?it is not fun. you should make arrangement of stickers.nor,i will uninstall this app.", rating: 3 },
  { id: "PB-048", text: "fixed sticky notification :) but can't sign in :( the stick notification is not displayed is fixed thank u :) but can't log in please help", rating: 4 },
  { id: "PB-049", text: "stay on your toes with a new issue every month every time i solve an issue with this app, a new one seems to crop up. recently i stopped receiving sms from my husband who uses google voice. went through the troubleshooter which directed me to make sure his messages aren't ending up in the spam folder. well, that's only accessible from the desktop app. you can't even view spam messages from the android app, or the mobile website. gtfohwtbs.", rating: 1 },
  { id: "PB-050", text: "glitch: not working on galaxy note 5 this is my third time downloading on my note 5, which is less than 1 week old. worked perfectly on the note 4. what happens is that at first, right after install, it works good. then, i am not able to touch the top lefthand icon which gets me to all my channel options. so, i'm installing again.", rating: 2 },
  { id: "PB-051", text: "old is best old version  is better then this version", rating: 1 },
  { id: "PB-052", text: "profile issues samsung galaxy s4 active: so every time i post a pic on fb it says not available and i can't even edit it! it shows some gray part on top. plzz fix it. i would of rated a 5, but since this happened. i rated 2...", rating: 3 },
  { id: "PB-053", text: "messenger/facebook integration issue ever since the last update, initial received messages don't get pushed to the messenger app and you don't get notification in the facebook app or messenger app. you open the facebook app and happen to see you have a message. you have to click the icon and it opens messenger. subsequent messages go through messenger app, unless you close the chat head... then you start over with no notification and having to go through the facebook app.", rating: 2 },
  { id: "PB-054", text: "seriously needs usability updates. app is ok but storage jumps from free to $10/mo after downloading files dropbox asks to upload it, great, but it asks for the folder every time from the root directory! still, there is no intermediate plan for storage, it goes from free to $10 /mo for 1 tb. i don't need 1 tb, but i do need something more than the free plan. google drive will be my new storage since they offer an intermediate plan. i asked for something middle of the road but they aren't interested. i'm going to drop dropbox where it belongs! in the trash box...", rating: 2 },
  { id: "PB-055", text: "good app but......... why do post come up in a random order on the home screen, i have 4 day old posts at the top and have to scroll down to find new posts which are buried between 1 day to 1 week old posts, it needs to have an option for what order you want the posts in.", rating: 2 },
  { id: "PB-056", text: "immediate action needed. on clicking a link ,  it now shows tab saved in firefox, tap to open now..instead of opening directly...this is not good feature and lot more people also do not like it. do change it", rating: 1 },
  { id: "PB-057", text: "fb notification turns on automatically even after disabling it and tamil language is not quite clear......", rating: 1 },
  { id: "PB-058", text: "fix or i quit don't download this game the new update sucks and is just a money grab for the developers. the game won't load half the time and it kicks you off before you can even play. not to mention the new rules are made to make you buy gems rather than raid for supplies. i have used a lot of money over the years yes years to have you all of a sudden change the rules on farming and game play. fix these issues or i'm done but from what i see in the other comments i don't think the developers even care.", rating: 2 },
  { id: "PB-059", text: "hooked - but no cutting out it's a fab game and i'm hooked but i do get kicked out on occasions part way through a game.", rating: 2 },
  { id: "PB-060", text: "new update sux! no more dead bases, no more farming, you're almost often match with the same th level or higher, new shield system sucks too.", rating: 2 },
  { id: "PB-061", text: "no longer a casual game the current version of the game makes it too hard to play casually anymore. expect to spend 4-6 hours a day, just to stay afloat.", rating: 5 },
  { id: "PB-062", text: "i think this game is such a load of rubbish it tries to con you into buying stuff from the instore app and cause you dont buy anything then you can be stuck on one part of the game for ages worsed app ive ever come across", rating: 2 },
  { id: "PB-063", text: "wechat wallet still disappears people have been using wechat wallet in the english ios app for ages now with no problems, and yet when i put my android wechat app into english, wallet disappears! please fix the english android app so that wallet doesn't disappear when i change language from chinese to english. wechat wallet is incredibly useful, but only when you can actually use it!", rating: 1 },
  { id: "PB-064", text: "back to greatness previously couldn't compose a single message before the app crashed. dev's fixed issue very quickly. well done.", rating: 4 },
  { id: "PB-065", text: "the authority firefox is firefox, after wandering here and there you are gonna come back to this standard browser in any platform.", rating: 4 },
  { id: "PB-066", text: "no auto upload for photos what worked super on my s4 does not work on nexus 6p, i have to open the app for photos to back up. sad. very sad.", rating: 2 },
  { id: "PB-067", text: "i love it i love using uc browser mini because browsing speed of it is marvelous and mind blowing and the size of this app is so small. so overall i would like to say that size of it is small but the work of it is big and awesome.", rating: 4 },
  { id: "PB-068", text: "rashifal ni homepagemai bhaye sun ma sugandha hune.", rating: 5 },
  { id: "PB-069", text: "still the best mini i like the new look and news front, very fast and efficient, though for overall best all around browsers id go with maxthon, yandex and uc...but for mini's opera mini gold though uc mini is coming along strong..***minuses: needs an adblock.", rating: 4 },
  { id: "PB-070", text: "still rubbish, still can't log in. fb inspired interface is completely unprofessional. can't log into the app with my password. works on the website, not on the app. takes me back and forth from the login screen to verification and back..the facebook inspired interface is just too unprofessional.", rating: 3 },
  { id: "PB-071", text: "old version was better this new version needs lots of work. find web pages take much longer to load. can't tell it not to remember passwords for all sites.", rating: 1 },
  { id: "PB-072", text: "it was good untill i upgrade overall opera mini is good. the page loads faster and saves time. but most of the time eventhough i have a good network connection, it will show that there is no network connection. then , when i upgrade to this version . the network speed after this update is really so fast....when i tried to download a song . eventhough i have 3g connection it downloads at a rate of 4.7 kb/sec . it took 20 mins to download a 6mb song in a 3g connection. i am really frustrated with this ...so i am going to uninstall it.", rating: 2 },
  { id: "PB-073", text: "dami xa hajur harule ni hernu hai", rating: 5 },
  { id: "PB-074", text: "please fix this new version. new version seems not good. i cannot open my viber account. when i tried to open it, it'll automatically stopped. please fix this one. thank you.", rating: 2 },
  { id: "PB-075", text: "1 major annoyance in the new update show who is online and define what online means.  on hangouts? on a google product?  using g+? can you re-add timestamps for each message? please add a dark mode feature as well", rating: 1 },
  { id: "PB-076", text: "for the build 13.0.2036.98649  new colour scheme adds nothing to the expirience. but it's the automated smart language update, with no option to select the prefered language that'll be the main reason why i'll uninstall this app.", rating: 1 },
  { id: "PB-077", text: "shite. crashes constantly! test 1st does nothing a browser should. obviously as all basic function is gone no testing was executed prior to release.      i do not use youtube or any sites that require more than a browser that loads the page without freezing & *bonus!* crashing the operating system.", rating: 1 },
  { id: "PB-078", text: "really? i honestly ussd to love this app.... now i realize it's honestly terrible. i still use it every so often but for sms, i suppose theres bulk in the programming but i can have 4g lte and be told i have no signal to send a text. you're better than this google!", rating: 2 },
  { id: "PB-079", text: "very good apps ŕ¤§ŕľŕ¤°ŕľ ŕ¤°ŕ¤žŕ¤žŕľŕ¤°ŕľ ŕ¤  ŕ¤¤ŕ¤° ŕ¤šŕ¤žŕ¤žŕľŕ¤°ŕľ ŕ¤żŕľ ŕ¤¸ŕľŕ¤źŕ¤żŕ¤§ŕ¤ž ios  operating  system ŕ¤žŕ¤ž ŕ¤ŕ¤šŕ¤żŕ¤˛ŕľ ŕ¤ŕ¤ŕ¤ŕ¤ ŕ¤šŕľŕ¤˛ŕ¤ž ŕ¤ŕ¤žŕ¤¨ŕ¤ŕ¤žŕ¤°ŕľ ŕ¤ŕ¤°ŕ¤žŕ¤ŕ¤śŕ¤żŕ¤¨ ŕ¤¸ŕ¤ŕľŕ¤¨ŕľŕ¤šŕľŕ¤¨ŕľŕ¤ŕľ¤", rating: 5 },
  { id: "PB-080", text: "bug fixes required this version is much better than the previous one in terms of ui design, and data compression. this version gives me at least 86% saving. the saved pages view is good, as well as the tab previews. please provide an option to disable vibration for the facebook push notifications. and fix the in built wikipedia search engine language. every time i search for something through it, the page appears in german. i have to manually go to the english version of the page and search. please fix this.", rating: 2 },
  { id: "PB-081", text: "some problems on showing pics after download android 5.1.1 can wechat team have the troubleshooting procedure. i viewed the previous standard tips from wechat tencent, it didn't work at all.", rating: 1 },
  { id: "PB-082", text: "nice for the size ,it's great ! nice ui , small footprint. complain ? u belong in scroogle's camp !", rating: 2 },
  { id: "PB-083", text: "wth why i can't login into wechat once i uninstall thn tried to re-download it's shown as can't install app ' wechat ' can't be installed , try again server error 505 all my other apps can open why not wechat ! fixed this problem as well plsss &gt;&lt;", rating: 2 },
  { id: "PB-084", text: "it used up my battery!!!!!! i forgot to switch back to my home screen and keep opening dropbox app, then my battery dropped from 50% to 25% in 30mins. it really is a 'drop'box.", rating: 1 },
  { id: "PB-085", text: "could be so much better if they'd stop making unneeded changes. while i love twitter, i hate that there is no paid service to remove ads. also there should be a quicker way to access your lists (like a shortcut on the home screen to a specific list would be awesome) and also i've heard that twitter is testing a non-chronological timeline. that is the worst idea ever. if that is implemented without a way to turn it off, i won't use twitter anymore. honestly, if third party apps had push notifications, i wouldn't use the official app at all. oh, and moments is dumb.", rating: 1 },
  { id: "PB-086", text: "the new theme is not compatible with my device :( (samsung galaxy j1) make it compatible please. i really love this game.", rating: 3 },
  { id: "PB-087", text: "awesome aafnaii vasa ma lekhna paauda khusii lagyoo....eaataii aaru aaps haru pani nikaldaii gaarnuu hoola", rating: 5 },
  { id: "PB-088", text: "every time i press the send button, a black background appears. this doesn't happen before the update. it sucks coz it forces whatever i'm doing to stop, like watching videos.", rating: 3 },
  { id: "PB-089", text: "unfollow tool does not function unfollow controls do not work on my tablet for friends. i have to go to a pc based messenger to adjust this feature", rating: 1 },
  { id: "PB-090", text: "one of the best apps ever at first i was a bit skeptical but i got used to it and now i can't work without it. better even than onenote. at least for what i'm concerned.", rating: 4 },
  { id: "PB-091", text: "its not safe it has a link to gallery and file manager also.  so anone can easily get access to my private photos without any password or restriction", rating: 3 },
  { id: "PB-092", text: "very smooth i'd say it's much better than just uc browser which loads pages as if you are on your laptop with a really bad server. love everything about it !", rating: 4 },
  { id: "PB-093", text: "it was good but the last update caused so many forced close. it was good but the last update caused so many forced close. now i can't really enjoy my browsing experience. thanks for nothing", rating: 3 },
  { id: "PB-094", text: "thanks u so much for adding sanshkar fm kalaiya all in one ones app thanks so much dont update its great version", rating: 4 },
  { id: "PB-095", text: "so fun! i'm totally addicted to this game. i play it way too much because it's so fun and has really smooth game play.", rating: 5 },
  { id: "PB-096", text: "bookmarking is no good i used to be able to pick where i bookmarked something when i made it. now it saves default to mobile bookmarks folder and i then have to go find the bookmark and edit it to move it where i want it. also when opening bookmarks list it does not open where i was last. it opens up a random list of bookmarks. it was perfectly fine how it was previously, now its just rediculus.", rating: 3 },
  { id: "PB-097", text: "good good for slow connection this uc minilite version does not take much space/memory in ram. it is faster also than uc.", rating: 4 },
  { id: "PB-098", text: "daammiiiiiiiiiiiiiiiiiii aapsssssss dherai ramro lagyo hami sabai nepali daju bhai haru lai ek choti yo aap use garnu parne i loved.......", rating: 5 },
  { id: "PB-099", text: "was great, broken with marshmallow i lauded evernote for working across more devices and os than other products. but dropping stars as with android 6, if you format sdcard as internal (required to effectively use sdcard for apps and games), evernote will not run; it asks for a 'memory card'.", rating: 4 },
  { id: "PB-100", text: "doesn't work anymore before the last update it worked just fine on my tablet but now it will start to open then close down.", rating: 3 },
  { id: "PB-101", text: "problem i am on a samsung galaxy s6 and now it seems like i can't log in. telling me that my pswrd does not work and when i try to reset it says that the number is banned?  really frustrating as i have been on for one day and i thought the app was amazing until now.  please tell me how to fix this problem.  this app is problematic and no one helps", rating: 1 },
  { id: "PB-102", text: "its really good but.. not everyone in your address book is exactly a friend.. sometimes u dont want certain people to see ua status or dps... even if u knw them well... so if there could be an additional feature like a favourite list or something like that i would give it a 5 star fo sure...", rating: 5 },
  { id: "PB-103", text: "good app.. it's a good app for people especially student like me...but i just think that it would be better if it become more colourful..maybe not too colourful but more colour..it will be more attractive to student like me to use it..thanks for the app btw..", rating: 5 },
  { id: "PB-104", text: "this update completely destroyed my facebook. it loads to the status screen but once i try click anything at all or scroll the app goes to my home screen. it doesn't even say force close, it just does it so i load it again and finally begin scrolling but not even 5 scrolls later the app closes.... this never happened before i updated fb!!", rating: 3 },
  { id: "PB-105", text: "keeps crashing ever since i started using it more, it will crash every ten minutes. its starting to get more annoying, however it is convenient for saving text messages since i don't have unlimited messaging", rating: 1 },
  { id: "PB-106", text: "sucks the new update especially the multiplayer game bonuses sucks... please return to before system... only this time im getting more loots but supercell stop it saying im playing too long without shield then u got my village under attack and loose many of my loots... ur crazy... đ", rating: 2 },
  { id: "PB-107", text: "lacks caps lock function because there is no caps lock function its really bothering when we have to type words with all capital letter... i will rate it five star, even higher if possiple, if the caps lock function is added...", rating: 4 },
  { id: "PB-108", text: "multitab button on top-right side is missing! ! so u cant switch between multiple tabs easily bcoz the small box on the top-right corner (that tells u how many tabs r open) isn't there any more. also, when u play video in a website, the audio and video wont be moving at the same speed, meaning the video frams will move ridiculously slow while audio plays at regular speed. i guess thats the problem with the flash player. overall poor web experience with this browser.", rating: 1 },
  { id: "PB-109", text: "you dont have to go to your wall calender and turn the page for your month event...this apps is just awesome.", rating: 4 },
  { id: "PB-110", text: "on sgh-i727 android 4.1.2 the new platform showing all contacts reduced your rating not just like the online status that doesn't give us option to identify our contacts that are online without having to tap on contacts one by one to see there  individual online status and without necessarily having your disable/enable our personal settings. useless option that doesn't work ...frustrated users ratings going lower and lower..loosing your edge specialy with no response from you, other than the automated generic in privaye email", rating: 2 },
  { id: "PB-111", text: "not usable no matter what i try, i cannot save images from web pages. it downloads the .html files instead of .jpeg", rating: 1 },
  { id: "PB-112", text: "brilliant but not complete please add more emojis. and if possible themes too. u need to compete with others eventually.", rating: 4 },
  { id: "PB-113", text: "i have to call it one of the most addictive games ever.... but now i'm dropping my rating because it took all my bonus candy away with the last update.. fix that guys... not ok!", rating: 3 },
  { id: "PB-114", text: "best browser for android if you want a browser for android then this is the best browser however to download wallpapers it is not good because it downloads it in bad quality otherwise it is best", rating: 4 },
  { id: "PB-115", text: "5-stars.! this app has saved my life on multiple occasions...pictures are life and you help keep mine with me", rating: 5 },
  { id: "PB-116", text: "does what it says it does, but chat heads have limitations. the issue i have almost everyday is that when a conversation is open in a chat head, you can not paste what is copied to your clipboard. everything is works fine enough.", rating: 5 },
  { id: "PB-117", text: "its getting there. i used to be a chrome/opera aficionado but lately they eat too much ram that my phone starts to hang. firefox memory consumption is far less and it's more stable. however, i dislike how websites get blurred when scrolling then slowly clear up like a jpeg being downloaded on a slow connection. i use 4g and bandwidth ain't a problem. i know you can fix it but i'll give you 4 stars for now. thanks for the awesome* browser.", rating: 1 },
  { id: "PB-118", text: "can't switch back you have to go to phone setting to switch to another keyboard. you should add choose input method on keyboard. if i'm missing it, teach me how to find that", rating: 4 },
  { id: "PB-119", text: "not responding occasionally sometimes chrome just won't respond. it doesn't seem to be fixated on a certain website or so, it happens at random. it is far much better than before. and yes it's not my phone's fault as i can just press the home button and operate my phone, no problem there.", rating: 1 },
  { id: "PB-120", text: "jill you have lost all my photos.i push drop box.and you tell me to set up a new dropbox..all is gone..return my photos.will look again tomorrow..bad service people..", rating: 2 },
  { id: "PB-121", text: "your new update sucks it's now impossible to loot 2m in 4 hours. wtf. are you kidding me supercell? no more dead bases and spent 500k to find a semi dead base with 180k loot. dafuq u. ./,", rating: 2 },
  { id: "PB-122", text: "can't hook up credit card to wallet unable to connect american express credit card to wallet. get the message system is busy. please try again later.     also, why can't we post just at text post to our moments?", rating: 1 },
  { id: "PB-123", text: "showing old news why is it showing that someone responded to my comment a week ago? i'm not getting any crashing but its showing stuff from a week ago on top of my news feed.", rating: 2 },
  { id: "PB-124", text: "very useful but very useful and good performance improvements. but i can not find a way to set myself 'online' or 'away' anymore after the update. where did it go?", rating: 5 },
  { id: "PB-125", text: "i found this app very fruitful.. and m using it but can you please tell me how to write ŕ¤ŕ¤§ŕ¤ž ŕ¤ŕ¤ŕľŕ¤ˇŕ¤°", rating: 4 },
  { id: "PB-126", text: "better user interface, worse quality the user interface is definitely better now but at the same time there is a bug concerning synchronising the contacts with the phone contacts, and even when that bug got fixed the contact photo doesn't get shown any more in contrary to previous releases!!!", rating: 1 },
  { id: "PB-127", text: "good job but.... please reduce its size. running services should consume less memory in background.  in new version there is no option to show only viber accounts in contacts menu, it shows all contacts only.  blocked contacts should be invisible after blocking.show only allowed contacts. thanks.", rating: 1 },
  { id: "PB-128", text: "very good application ever dharai ramro app ho yo but kalo background malai aalikati man paren plz hamrokeyboard team lai yo bharema ali sochnuna maile anurodh garchu", rating: 4 },
  { id: "PB-129", text: "the new updates are cool but ... whenever i try to favourite a tweet now, it closes the app saying unfortunately, twitter has stopped. maybe it's just my android idk", rating: 2 },
  { id: "PB-130", text: "i met my life here  my girlfriend heads off the app.  thank you wechat &  the entire team .", rating: 2 },
  { id: "PB-131", text: "more than notes! just use it for notes, but it is a powerful app. like the checklist, but we use a shopping list program for that and sync with my wife's htc m8. may want to try sharing with this app soon, though.", rating: 4 },
  { id: "PB-132", text: "lack of options and closed code so many options for years not implemented and now whatsapp is simply copy pasting the features telegram creates. moved to telegram which is whatsapp but on steroids which even offers desktop integration so you can use it on the pc and more.", rating: 1 },
  { id: "PB-133", text: "poor data/wifi transition still doesn't work with wifi networks. even the socket/http protocol doesn't help. please learn from whatsapp!", rating: 1 },
  { id: "PB-134", text: "pretty good the people who don't like the power ups can just turn them off in the first part of the game!!!!! i also like the red's mighty feathers.", rating: 5 },
  { id: "PB-135", text: "it was, working great,  before, the bugs.  worse,  with the bugd, and without", rating: 1 },
  { id: "PB-136", text: "error i can't log in, its says error occured while logging in please try again later. i tried it several times, restarted my wifi and phone. still can't log in. please fix it :(", rating: 3 },
  { id: "PB-137", text: "cool app except the notifications freeze, so i have no idea of the upload status. even worse dunno if it even worked or safe to delete those files. becomes more of a broken app to me. another issue i wanted to create a new account for a friends new phone. exclaimed that 2 year 50 gig is available and it shows it is until after you waste time following all of your steps to get 250 mbs or something worthless. keep it honest.", rating: 1 },
  { id: "PB-138", text: "makes top left of my screen unresponsive many lg v10 users lose the ability to tap the top left of their screen when this app is installed. this issue makes uses other apps impractical and sometimes impossible as this issue holds phones hostage. if fixed i'll change my review to 5 stars.", rating: 3 },
  { id: "PB-139", text: "very good i liked the app and it's ui but i think the app can be best if you add option to remind us about any program on radio so that i wouldn't miss my fav programs like timepass :) ....keep developing", rating: 4 },
  { id: "PB-140", text: "viber rating - lacking code on the android phone, the in call widget is over the top command for all settings alterations on the screen. it is not able to be moved and i can't find the setting to turn it off. might wanna fix it. also it seems not to want to ring on the android phone when you make a call.", rating: 1 },
  { id: "PB-141", text: "great application, but the premium notifications have become too invasive, leading to unpleasant clutter. alternative options are becoming much more attractive due to this.", rating: 2 },
  { id: "PB-142", text: "nice app i suggest you to add a word-count feature and font size. i think it's essential feature for a note app. but, well, keep the good things up! you've done a really amazing job! thanks!  đâąâąâąâąâą", rating: 5 },
  { id: "PB-143", text: "doesn't let me click into anything always tells me to check my connection while there is literally nothing wrong with my connection. i can scroll through my timeline i just can't click into anything since i updated. missing my old version smh", rating: 2 },
  { id: "PB-144", text: "too much pop up add average app with too much advertisement. one star for the app and 5 star for the pop up advertisement.", rating: 2 },
  { id: "PB-145", text: "two stars cuz after the update it isnt working properly it remains connected but when i send a msg it is automatically disconnectec and ths msg takes aprrox 2 mins or more to send...plz fix this prob as soon as possible...tnx", rating: 1 },
  { id: "PB-146", text: "ui & customization dark theme and color options. reply directly from the notification panel. options to change contact photos to initials and hide the timestamps. please bring back the gesture that takes you back to the conversation list by swiping from the left edge. write a message area is too cluttered, make it simplistic with a + sign. replace visible phone number with the name of the contact in send sms to...", rating: 1 },
  { id: "PB-147", text: "great app, but one problem ruins it i love the firefox for android. it's fast and efficient, and all the addons are great. yet, the menu key problem ruins the app. firefox will automatically turn on or off the menu key based on if it detects a hardware menu button. the only  problem is it gets it wrong sometimes, and there's no way to force it.", rating: 4 },
  { id: "PB-148", text: "translation use it for browsing and visiting viet and chinese and other country sites for translations, but using uc browser for downloading.. no other app can replace uc for fast downloading speed..", rating: 2 },
  { id: "PB-149", text: "takes longer time plz make d newspaper download format..it takes longer time to fetch newz...very poor app otherwise...y same pages are repeated again & again in epaper segment??", rating: 2 },
  { id: "PB-150", text: "what has happened! it doesn't give me my messages on time and people can not hear me on outcalls at all! please fix other wise i would give it 5 stars!", rating: 1 },
  { id: "PB-151", text: "why what's app does not support same account on multiple devices that's security but that's not good i buy a new phn sometimes i used to go with any phn then i have to switch to that that's not good should support same account on multiple devices", rating: 2 },
  { id: "PB-152", text: "what the heck?! can't get status updates to be in chronological order...half of my comments don't post...it worked fine before the last update...keeps kicking me out of the app for no reason.  won't let me tag people without their name being all jumbled. if i edit a post, it shows the unedited version at the top of my feed. i'm 2 seconds away from uninstalling.", rating: 2 },
  { id: "PB-153", text: "i can't get back on facebook it's my email thats wrong or my password. no matter what i do it just sucks because, i really want to talk to my grandchildren. that's the only way i can see or hear from them most of the time.", rating: 1 },
  { id: "PB-154", text: "few ui updates 1. group should be included with group status... so that if common event is there then the event can be posted through group status.. and group name need not be changed. . . as it becomes difficult to identify a particular group if a particular festival is there and all group name seems to be similar.         2. profile picture and profile status should be at one place not seperate... for status we have shortcut but for profile picture we have to go into settings then profile then comes profile picture.", rating: 1 },
  { id: "PB-155", text: "easy to use, safe super easy to use! fantastic online backup/storage app. two-step verification makes this relatively safe", rating: 5 },
  { id: "PB-156", text: "external links are not working after updated to latest version.. could not able to open any links on facebook .. it's says connect to network after some time , plz check your network connection .. same time my connection is 4g network is at full speed .. plz fix this issue asap ..thanks", rating: 3 },
  { id: "PB-157", text: "man i hate google and android went into my messaging and the default had changed to hangouts instead of sms. stop forcing settings to change when you push through updates! man i'm moving to apple as soon as i am able! i hate this phone and your system!!!", rating: 3 },
  { id: "PB-158", text: "can't work after latest update i keep getting the message that the app has stopped working after last update. phone screen freezes and can't use the phone until i reported the problem (sent feedback). please fix or i will uninstall. on samsung galaxy note, first model.", rating: 1 },
  { id: "PB-159", text: "what's new: broken. differently. again.. too bad google is such a small company it doesn't have the resources to create a good product. the latest update has now made the camera go almost black and the speaker has stopped functioning. i have to hold the phone up to my ear to hear the other person.", rating: 2 },
  { id: "PB-160", text: "kill pages i will enter a url or open a new link and nothing loads. no loading bar, no error page - the page stays the same. also if i switch to a new tab, sometimes that won't load/refresh, or if i switch back to an old tab the same thing happens.", rating: 2 },
  { id: "PB-161", text: "can you say ads every time i open a tweet there's an ad sitting at the bottom. they appear ridiculously frequently throughout my feed. i get that developers are trying to make a living but come on this is so excessive", rating: 2 },
  { id: "PB-162", text: "downloading files in background i started a song download but it failed,  then after 2 minutes it automatically downloaded 2 copies of the song in background....", rating: 5 },
  { id: "PB-163", text: "good as far as i have it fast and reliable. for now. only thing is that scroll speed is somewhat faast, but thats mayth be due some option in phone maybee", rating: 5 },
  { id: "PB-164", text: "gone crazy after latest updates..it seems to force closed by itself even if i dont use it..always popup a error msg almost everyday..it seems to trigger whenever i switch between mobile data and wifi connection..", rating: 1 },
  { id: "PB-165", text: "not supported i am using panasonic t10 and frozen shadows are not supported. i will be very great full if you will fix this.", rating: 2 },
  { id: "PB-166", text: "pls fix these bugs : when ever u  set the search engine as google it again automatically shifts to yahoo and yahoo is sick imean iam really fond of google so please ...fix this bug..", rating: 2 },
  { id: "PB-167", text: "bugs, bugs, and more bugs with each update. if you're unable to improve something which was already good, then don't #$&@ it up!(google talk?)  notifications bugs are all over the place. edit: application must be reloaded ultimately to be able to view messages.  edit: now crashes all day long and requires phone reboot each time.", rating: 2 },
  { id: "PB-168", text: "love it!!!!!!! i love angry birds, i can sit and play on for hours upon end. love the challenges they threw at me", rating: 5 },
  { id: "PB-169", text: "can't call i can't  make out going calls to anyone on facebook..  when the person im calling answers the call it says contacting then after a few mins an operator says that the person in calling can't be reach and that i have to leave a message after the beep.", rating: 1 },
  { id: "PB-170", text: "firefox for android. ok, not full firefox, but a good interpretation for small touchscreen devices. firefox sync works well. bookmarks and search history transfer as expected. really helps following up with web searching on the road when i get home to the computer.", rating: 4 },
  { id: "PB-171", text: "good its very good to use .   but i found some fualts .  while writing lengthy status ,the words which we enter at starting will not be visible. so to edit those words we should slide through the text we have written .  so make status editing line step by step instead a single line.", rating: 4 },
  { id: "PB-172", text: "one issue.big files downloading very slow i cant download 15+ mb files quick.please fix it on next update", rating: 1 },
  { id: "PB-173", text: "almost good enough i have tried lots of android browsers. the reason being that i like speed and simplicity and good bookmark management. that's all i need. i tried firefox (which i use on desktop) as a way of getting away from chrome, because i absolutely hate google and everything and everybody associated with it. seriously, i hate google. unfortunately, chrome is still hands down the best browser i've used on android. firefox started out fine, but became slower and glitchier as i used it, like everything except chrome. meh", rating: 4 },
  { id: "PB-174", text: "totally diferent from the web page do not use this app, use the web page instead, you will be able to do much more from there. it is almost impossible to apply to a job from here.", rating: 2 },
  { id: "PB-175", text: "camera roll please can you stop the camera roll popping up at top of page!!! whenever it does i can't use the app or my phone for a few mins !! doing my nut in", rating: 1 },
  { id: "PB-176", text: "this new update crashed with my samsung note4 my phone suddenly all black out &  shut down, after receiving a wechat message notification after update. my chat backgrounds were all gone blank & i can't find my stickers as well!! i have to uninstall the app,  but don't know if my chat history will be here or not..", rating: 2 },
  { id: "PB-177", text: "unstable call connection it's showing an unstable call connection message on screen whenever i try to call my dear ones. then it's getting worse and leading into self disconnection of calls. i hope u guys notice it and make sure the problem should be solved", rating: 2 },
  { id: "PB-178", text: "two stars it used to work really well and the colors and nicknames and emojis are really cool and the snow and the hearts when sending some emojis are really cool. but the last update really s***s. can't use any other app when using the chat heads, youtube stops when using the chat heads, the message sending is slow, sometimes it doesn't even feel that i'm connected to the internet and sometimes can't even send the messages. please fix it as soon as possible.", rating: 1 },
  { id: "PB-179", text: "this has made my life hell!! it really sucks my cell hanged most of the time when it was there needs to improve so much đ đ đ", rating: 2 },
  { id: "PB-180", text: "wonderful for project coordination this is a great tool to have when coordinating projects. it keeps everyone on the same page and in communication.", rating: 4 },
  { id: "PB-181", text: "good this is a very good app so far. great features and overall performance.", rating: 4 },
  { id: "PB-182", text: "can't open after update the app crashes and doesn't open neither for a second! uninstalled and installed many times - no change! please let me know how to fix it! people write me there and i don't receive nothing.", rating: 3 },
  { id: "PB-183", text: "well done nicely designed .....this app had collected daily used collection of apps  . liked it.", rating: 4 },
  { id: "PB-184", text: "#1 great game. challenging to the point where you don't want to give it up. great thing while you're bored, waiting or just want to play. can't stop playing. great job rovio.", rating: 5 },
  { id: "PB-185", text: "latest update should be clientside the most recent update added the following features which need to be changed to client side only: colour, nicknames, and emoji. all three change the appearance of the chat stream and are community controlled. these are issues because they change everyone's layout. they need to be controlled by every individual of their own choosing.", rating: 3 },
  { id: "PB-186", text: "love this app all in one nepalese app ...", rating: 5 },
  { id: "PB-187", text: "regular uc better on powerful devices this is very similar to the regular uc browser in function. in some ways the layout is cleaner especially in the settings menu. the major advantage here is in memory usage typically this will use about 40mb starting up.  the regular uc browser uses almost four times the memory. however on my samsung galaxy edge the scroll speed is very laggy and stilted. i love uc but i'm sticking with the full version where no such lag occurs. it's probably not fair to compare them on a high end phone however.", rating: 5 },
  { id: "PB-188", text: "not a fan of new update new update makes it difficult to progress unless you attack several times during your shield period.  i can't get ahead. i play twice a day if i can.  can't commit to getting on 4-6 times a day.", rating: 2 },
  { id: "PB-189", text: "video issues sometimes videos uploaded from places like vine won't load and will play but the screen will show grey. fix please, i don't know if others have this issue, but i am on my samsung s6 and it is doing this.", rating: 3 },
  { id: "PB-190", text: "old is gold i used to play this game a lot when iwas nearly in 4 std but even after 4 years when i'm in 8 the this game still continues to be my fav . i really never get tired of playing this as u know now that this is my fav.", rating: 4 },
  { id: "PB-191", text: "unstable, freezes and crashes customisatins and capabilities are unmatched, but seems to freeze way too much atm. some video's won't play that do on other browsers. can't even arrange bookmarks. looking at other browsers now.", rating: 1 },
  { id: "PB-192", text: "new theme its a fun game.......its great to see some new items added to the game. the frozen shadows makes the new challenges a lot more fun.", rating: 4 },
  { id: "PB-193", text: "worst update,!! slow ,,,!! my phone frequent hang once opened this app, typed message half way then can't move at all ,whole screen stucked, been forced close the app manyyyy timess...!!! whole app functions become slowww.. loading damn slow &gt;,&lt;   what happpenedd??? thought new update shld have improvement but y getting worse...???  it wasted me lots of time !!  plss help solve it, tq so much !", rating: 2 },
  { id: "PB-194", text: "simply brilliant simply brilliant, no problems so far.  the best feature of this is the accordion of tasks that are grouped.  could not login with google but simply clicked forgot password and set a new password and it worked perfectly as described in both the description and app.  cheers.", rating: 5 },
  { id: "PB-195", text: "load shedding widget not syncing the load shedding widget does not sync. otherwise the app is awesome for me.", rating: 5 },
  { id: "PB-196", text: "browser issue hi team, when ever i press the back button/option, automatically it's closing the browser with a message. please fix this issue.", rating: 1 },
  { id: "PB-197", text: "force close it's been 1 or 2 months and y'all still haven't fix the error. i can't play, it's always crash and force to close everytime i'm online for 10 seconds.", rating: 2 },
  { id: "PB-198", text: "best free note ever !!! sometimes evernote pop up to purchase premium but its not annoying .. features and multiple devices support are very wide use. awesome and i love it.", rating: 4 },
  { id: "PB-199", text: "best apps ŕ¤żŕľ apps use ŕ¤ŕ¤°ŕľŕ¤ŕľ ŕ¤§ŕľŕ¤°ŕľ ŕ¤¨ŕľ ŕ¤žŕ¤¨ ŕ¤şŕ¤°ŕľŕ¤żŕľ ŕ¤¤ŕ¤° ŕ¤ŕ¤ź computer ŕ¤ŕľ ŕ¤˛ŕ¤žŕ¤ŕ¤ż ŕ¤¨ŕ¤ż ŕ¤źŕ¤¨ŕ¤žŕ¤ŕ¤¨ŕľ ŕ¤­ŕ¤žŕ¤ŕľ ŕ¤­ŕ¤ ŕ¤ŕ¤˛ŕ¤ż ŕ¤°ŕ¤žŕ¤žŕľŕ¤°ŕľ ŕ¤šŕľŕ¤¨ŕľŕ¤ľŕľŕ¤żŕľ", rating: 5 },
  { id: "PB-200", text: "help me!!!!!!! my ipad had a software so i lost my base, i need it back, please, i left my base in a clan that shows my code on the top left on my profile, now i have 2 accounts please if any can help me i would really love this game, but at the moment nobody is helping me. thank you very much i hope you reply and i get my account back", rating: 1 },
  { id: "PB-201", text: "loved it i loooooooooooooovvved it because it is incredible  awesome  and it's in go power and make a new clash of clans the same thing  butt better", rating: 5 },
  { id: "PB-202", text: "good but not the better i can't see the videos sometimes, the notifications are bad and always the app isn't responding. this actually is the worst update. please check it", rating: 1 },
  { id: "PB-203", text: "the ads ruin my fav app i mean the ads for viber desktop. i dial my friend, start talking and what happens next is: my microphone turns off, speakers turn on and the browser starts launching. so my friend is saying something for everyone to hear because she cant hear me and i am pushing buttons like crazy trying to stop browser from launching. it does take a while on my phone. what happens every time is that viber desktop ad launches about 3s after i make a call. thats the right way to stop me using the smartphone app.", rating: 2 },
  { id: "PB-204", text: "great features, but my notifications don't work title says it all, the app says i should be getting the notifications on my phone but i'm not getting any. would rate 5 stars if this was resolved.", rating: 5 },
  { id: "PB-205", text: "everyone able to see  highest score i would like to given one idea ,i could not saw everyone higher score atleast 1 to 5 member,  i want to see each and everyone highest score through on my mobile , if you create this option, everyone will be try to achive the highest score ,i hope you will be create this option of temple run 2", rating: 5 },
  { id: "PB-206", text: "only two stars because frozen shadow is not compatible to my device đť why oh why?? đ­ make it compatible please..", rating: 2 },
  { id: "PB-207", text: "i love playing candy crush but... why when u go to another episode  you have to wait for along time for example i was in level 50 and i passed it and had to wait 75 hours for episode 3 the game is good and very addictive but i don't like the waiting for the episodes đł by the way good đwork", rating: 2 },
  { id: "PB-208", text: "update sucks!!! it has become so slow now that no page opens even on 3g. trying to make the user interface like chrome is a ridiculous idea. as everyone is saying the facebook page doesnt open n it even logged out. please roll back your stupid update.", rating: 3 },
  { id: "PB-209", text: "the app won't load since this update the app doesn't even load..it just stuck on downloading content and then restart..try to uninstall and re-install it but it's going the same error all the way..please fix this..!!", rating: 2 },
  { id: "PB-210", text: "always fun, but... i like this new frozen shadows, but the depth perception is not so good. it's hard to see an approaching corner. other then that small bug, i love this game and will continue to play it.", rating: 1 },
  { id: "PB-211", text: "occasionally i won't receive a notification of a message(s) so i don't know that someone has replied until i actually open the app and then suddenly lots of messages come through... 5 stars if that can be fixed", rating: 5 },
  { id: "PB-212", text: "fail on every update it was best app before you received messages but when you reply it wont send. video calling auto exit now even with good signal. it was very good before.", rating: 2 },
  { id: "PB-213", text: "wtf it worked for the last 3yrs. then all of a sudden almost all my msgs dont send. and neither does my friends. i tried meeting up with someone recently and we couldnt get each others msgs and missed out. i use to use it with one friend constantly and now it barely works. what the hell", rating: 3 },
  { id: "PB-214", text: "very useful thank you android for introducing me to drop box ! extremely useful (whether on android, computer or both !) now i can sync my personal files and doucments on all my devices and i can still securely access them online from any browser. not to forget to mention about the sharing options ... great app !", rating: 5 },
  { id: "PB-215", text: "a lil. more features to be included there should be a option so as to u the profile pic is not visible to everyone.. because if you block people then they can't even send you msges.. and also more no. of people in a group (maximum should be 500)", rating: 1 },
  { id: "PB-216", text: "suggestion. i given 5 stars to this game,  because i like it very much, but i have a suggestion to improve this game plz. when a color er bomb is mash with i striped candy, all of candies of the same color become striped and blast. but same action with tha rapped candy does not act like this. as works in candy crush soda saga. plz work on it. thanx. muhammad hanif karachi pakistan. no reply from admin, why ???????", rating: 5 },
  { id: "PB-217", text: "hamro keyboard it is fantastic app for mobile and to write in nepali or hindi. i use this app becoz type in english as nepali lipi it will change automatic in neali .eg. haami nepali hau it'll change into ŕ¤šŕ¤žŕ¤žŕľ ŕ¤¨ŕľŕ¤şŕ¤žŕ¤˛ŕľ ŕ¤šŕľŕľ¤ tq", rating: 5 },
  { id: "PB-218", text: "idk i can't edit my posts? things such as my profile picture, when i edit it, it becomes grey and says that it is no longer available. please fix. i have an htc desire. will rate 5 stars shown fixed đ", rating: 1 },
  { id: "PB-219", text: "great game i've enjoyed playing ever since i downloaded it this summer. i like it much more than the first one - the challenges and visuals are improved as well as the way you run through the game. highly recommend!", rating: 4 },
  { id: "PB-220", text: "not able to play, automatic closing since last two updates, not abke to play game. it closed suddenly in between automatically.", rating: 2 },
  { id: "PB-221", text: "it rocks this thing is  great, i keep documents, photos, everything, accessible on all my devices current. very slick", rating: 5 },
  { id: "PB-222", text: "neat idea, but let-down by no linux support. an application like evernote is only as useful as the service behind it, and the service behind a concept like evernote is only as useful as the availability of an application or program to connect to said service... which is where evernote fails - it is not natively available for linux-based operating systems (such as ubuntu). sure, the android application works well enough - but when the only way to access evernote under a linux-based operating system is via a web browser, it quickly looses its appeal.", rating: 3 },
  { id: "PB-223", text: "ŕ¤°ŕ¤žŕ¤žŕľŕ¤°ŕľ ŕ¤ yo hamro keyboard chai computerma pani banauda ramro hunthyo. tara i love it n thanks for this. i support u all", rating: 5 },
  { id: "PB-224", text: "it was a gud game, but slowest game on this planet, now new update make it more slower, u can't use spells to steal gold or elixir, duration for upgrading is high.. m deleting this game n i won't recommend anyone to play this game..", rating: 1 },
  { id: "PB-225", text: "how to upgrade angry birds angry birds is really cool however if you were to upgrade it i would make more birds do different things, second make more challenges and be able to customise your own birds with armour and different powers then  when you know what maps you have to destroy you can choose what bird will be best to use", rating: 5 },
  { id: "PB-226", text: "edit: wakelock has been fixed. thanks!      i used to love this app, but the latest version is holding massive wakelocks and burning through my battery.  would be 5 stars without this but essentially unusable now.  please fix this battery hog and it will be a 5-star app again!", rating: 4 },
  { id: "PB-227", text: "update sucks i have some friends who didn't play coc anymore. and their villages seems to forced out from search system. so there is no more loot in clash after the latest update. i can't upgrade my village and labratory. i think if supercell don't take care of this issue, they will lose a lot of players soon!", rating: 1 },
  { id: "PB-228", text: "why do u do this to me ok so i can't unlock the next episode for 48 hours or i have to pay money to buy gold. so i wait and wait and 48 hours later you tell me to wait 24 more hours because i didn't pay money. so here i'm still waiting not going to pay you money. so how long with this take?", rating: 3 },
  { id: "PB-229", text: "forgot my old wechat password! i want to reopen old wechat me .. but, i forgot my password for wechat old .. my old wechat info also incomplete .. there is no link with facebook .. i have no qq id .. telephone numbers also do not update .. but i remember my id .. how can i go back ?? please help me.. đ­", rating: 2 },
  { id: "PB-230", text: "sort it out why can i not get my networks posts in recent order on my mobile app? on my pc it happens, why am i looking at post from 1day ago before  posts say happening 1 hour ago? this is so annoying, how do you sort it out? also your help centre on mobile  is not working hence i have had to resort to this. what is going on?", rating: 1 },
  { id: "PB-231", text: "every company should use slack i don't usually give 5 stars, but man, slack is great for group company communication, in the office, at home, and on the go. takes a bit of getting used to but is well worth it.", rating: 5 },
  { id: "PB-232", text: "why can't i share my achievements? recently discovered that there is a feature for sharing any kind of achievement, however i can't accomplish it on my profile", rating: 2 },
  { id: "PB-233", text: "connection issues app always says can't refresh now, try later which in particular has to do with the net. but my wifi works well enough. i can even play online games. i can refresh my feed at ig and twitter so why can't i refresh my fb feed? fix it please.", rating: 3 },
  { id: "PB-234", text: "the only and major problem is it can't provide real-time notification.  but i love the web/desktop notification very much !", rating: 5 },
  { id: "PB-235", text: "not supported your new updated temple run 2 frozen shadows map is not supported to my device which is the samsung galaxy v. ill give 5 stars if you will make this updated map support my device plss i need to play that map, ive been waiting this for a couple of months", rating: 2 },
  { id: "PB-236", text: "app doesn't work after latest upgrade the facebook app refuses to work on my mobile data (3g) after the latest upgrade! it says it cannot connect right now.", rating: 2 },
  { id: "PB-237", text: "???? when  i open it download but it stop when it reaches to the letter o and it wont move even if there is strong connection.please fix it i really want to play", rating: 2 },
  { id: "PB-238", text: "very solid my one real complaint is no way to make anchor tags within a note so i can make a table of contents. otherwise great application.", rating: 4 },
  { id: "PB-239", text: "its ok useful app.xcept now, viber hasn't been working great.sometimes its says disconnected or something although i have a stable internet connection.i hope this gets fixed.", rating: 1 },
  { id: "PB-240", text: "contacts name and pic i wanna know why alot of my new contacts just don't appear only appears if they are online or not and their pic and status don't...  can this problem be solved?!!", rating: 1 },
  { id: "PB-241", text: "very poor service now a days for the last one month viber service is detoriated day by day...now the application respond too slow even in 3g network. in wifi the message is always displayed that no network available, please check your internet connection. what happend to developer team? are they sleeping? from google market viber has disappeared suddenly.", rating: 2 },
  { id: "PB-242", text: "excellent app. clearly a passion project. great work!", rating: 4 },
  { id: "PB-243", text: "i had over 500 lives and the game wouldn't work so i uninstalled it and reinstalled it and i lost all my men. give them back and i will change my rating. my gold was still there but not my lives. not a happy camper.", rating: 1 },
  { id: "PB-244", text: "the best i agree totally with the last poster. chrome is simply the best for android   period. i've tried all the other crap out there and yeah they have some more features none of which i ever used. i have chrome on my laptop and pc and all of this is synced together. simple, direct and to the point and that's what i like and don't forget very fast.", rating: 4 },
  { id: "PB-245", text: "simply good but... i think loss of reply option keeps people away from this app because, especially, in the groups, it's necessary to show whom your chatting with...", rating: 1 },
  { id: "PB-246", text: "samsung note 4 - awesome business platform! please consider adding an edit option in addition to delete for our posts. just in case we'd like to correct a mistake, rather than delete the whole thing.", rating: 3 },
  { id: "PB-247", text: "why change it? i use this for my facebook as it's a lot faster than any other app, but now when i try to add a pic the whole format on opera mini has changed! i can't even see the pic i want to choose now and have to go through so many folders as well, go back to the old format, why fix something that wasn't broken!!", rating: 2 },
  { id: "PB-248", text: "fail to launch i can sign i online via a pc but the app gets me nowhere. it downloaded fine but now that it is on my phone i am in a never ending sign in loop where i get their blurb, press the button to login, enter u/n & pw but then it takes me right back to the app's burn. frustrating to say the least after i was so looking forward to making use of this app after having downloading it on chrome.", rating: 2 },
  { id: "PB-249", text: "it's good i had typed up a longer review but then play store decided to crash... i'll just say that firefox for android feels faster and more stable than the default chrome browser. also the ui is less clunky.", rating: 1 },
  { id: "PB-250", text: "almost every time i scroll on a webpage, the copy dialog appears at the top of the page. also i don't care for the new tab opened/switch, popup that appears on the screen when i open another tab. i think that should be in the opera mini settings menu.", rating: 4 }
];
