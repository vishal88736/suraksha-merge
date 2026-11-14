/**
 * Interface message catalog.
 *
 * Every piece of chrome text in the application lives here. The English
 * catalog defines the shape of the catalog; every other locale must provide
 * a value for every key, so a missing translation is a type error rather
 * than a blank label in production.
 */
import {
  registerContent,
  type UiLocale,
} from "./locales.ts";
import { GENERATED_LOCALE_LOADERS } from "./generated/index.ts";

const en = {
  "intake.sourceMessage": "View analyzed customer message",
  "composer.shortcut": "Ctrl / ⌘ + Enter to run",
  "composer.transactionDate": "Transaction date",
  "composer.autoDetect": "Auto-detect language",
  "composer.voiceError":
    "Voice recognition could not finish. Please retry or type your message.",

  "desk.staleTitle": "Your inputs changed. Refresh the decision.",
  "desk.staleBody":
    "The visible draft and policy assessment describe the previous inputs. Run triage before copying or exporting.",
  "desk.runningTitle": "Checking the message and its evidence…",
  "desk.runningBody":
    "Your previous result remains visible while the new assessment is prepared.",
  "composer.apiKey": "Service API key",
  "composer.apiKeyHint":
    "Used only for this request session. Never stored or included in exports.",
  "composer.replyLanguage": "Customer reply language",
  "error.unauthorized":
    "This service requires an API key. Enter it below, then retry.",
  "error.rateLimited": "Too many requests. Wait a minute, then retry.",
  "error.timeout":
    "The request timed out. Your message is still here; please retry.",
  "error.invalidInput":
    "Check your message and operator context, then try again.",
  "error.tooLarge":
    "The message is too large. Keep it under 12,000 characters.",
  "error.invalidResponse":
    "The service returned an incomplete response. Please retry.",

  "nav.brandHome": "SurakshaDesk home",
  "nav.brandTagline": "CLARITY. CARE. CONFIDENCE.",
  "nav.workspace": "Research workspace",
  "nav.workspaceName": "Suraksha-Merge",
  "nav.section": "WORKSPACE",
  "nav.triageDesk": "Triage desk",
  "nav.pipeline": "Pipeline explorer",
  "nav.benchmarks": "Benchmark lab",
  "nav.policy": "Policy library",
  "nav.trustTitle": "Built around trust.",
  "nav.trustBody":
    "Every extracted field needs evidence. Every promise needs restraint.",
  "nav.trustLink": "Explore the policy spine",
  "nav.viewSource": "View source",
  "nav.operator": "Research operator",
  "nav.operatorDemo": "Demo workspace",
  "nav.breadcrumbRoot": "Workspace",
  "nav.interfaceLanguage": "Interface language",

  "topbar.engine": "Rule engine active",
  "topbar.engineModel": "Pilot model · rules fallback",
  "topbar.engineTrained": "Fine-tuned model · rules fallback",
  "topbar.research": "Research preview",

  "common.exportTrace": "Export trace",
  "common.exportConfiguration": "Export configuration",
  "common.dismiss": "Dismiss notification",
  "common.retry": "Retry",
  "common.reset": "Reset",
  "common.skipToContent": "Skip to main content",

  "desk.eyebrow": "SURAKSHA-MERGE / OPERATIONS",
  "desk.title": "A clearer next step.",
  "desk.subtitle":
    "Turn a worried customer’s message into structured, thoughtful action.",
  "desk.pipelineTitle": "One pipeline. Two specialists.",
  "desk.pipelineSubtitle":
    "Follow the journey from a noisy message to a verifiable response.",
  "desk.benchmarksTitle": "Evidence before confidence.",
  "desk.benchmarksSubtitle":
    "Six checkpoints. One held-out benchmark. No invented results.",
  "desk.policyTitle": "Grounded in the rules.",
  "desk.policySubtitle":
    "Versioned primary sources behind every triage recommendation.",

  "workflow.message": "Customer message",
  "workflow.privacy": "Privacy & provenance",
  "workflow.structured": "Structured triage",
  "workflow.draft": "Customer draft",
  "workflow.label": "ONE AUDITABLE FLOW",

  "intake.title": "Customer channel",
  "intake.subtitle": "Noisy messages. Human stories.",
  "intake.demoBadge": "SYNTHETIC DEMO",
  "intake.tryScenario": "TRY A SCENARIO",
  "intake.latestTriage": "LATEST TRIAGE",
  "intake.scenarioPreview": "SCENARIO PREVIEW",
  "intake.unrunChanges": "UNRUN CHANGES — RUN TRIAGE",
  "intake.customer": "Customer",
  "intake.draft": "Suraksha draft",
  "intake.forReview": "FOR REVIEW",
  "intake.machineTranslated": "MACHINE TRANSLATION · NEEDS REVIEW BY A NATIVE SPEAKER",
  "intake.copyReply": "Copy customer reply",
  "intake.maskPii": "Reveal original briefly",
  "intake.revealRaw": "Reveal raw PII",
  "intake.revealed": "Hide original now",
  "intake.urgency": "{severity} urgency",
  "intake.escalation": "Escalation guidance",
  "intake.draftFooter": "Draft prepared · no external action taken",

  "composer.heading": "Make it your own",
  "composer.placeholder":
    "Paste a customer message in Hinglish, Tanglish, Marathi or English…",
  "composer.run": "Run triage",
  "composer.running": "Analysing…",
  "composer.dictate": "Dictate",
  "composer.listening": "Listening…",
  "composer.stop": "Stop",
  "composer.voiceUnsupported":
    "Voice input is not supported in this browser. You can paste the message instead.",
  "composer.voiceDenied":
    "Microphone access was refused. Paste the message instead.",
  "composer.voiceEmpty":
    "No speech was recognised. Try again or paste the message.",
  "composer.languageHint":
    "The reply is written in the language detected from your message.",

  "composer.voiceConsent":
    "Dictation uses your browser's speech service, which may send the audio to the browser maker's servers (Chrome sends it to Google). Do not dictate real customer data.",
  "composer.voiceConsentAccept": "Dictate anyway",
  "composer.voiceConsentCancel": "Cancel",
  "composer.screenshot": "Read screenshot",
  "composer.screenshotReading": "Reading…",
  "composer.screenshotHint":
    "Add the text of a bank SMS or UPI receipt screenshot. It is read on this device; the image is not uploaded.",
  "composer.screenshotError": "Could not read that image. Use a PNG, JPEG or WebP under 8 MB.",
  "composer.screenshotEmpty": "No text found in that image.",
  "checklist.title": "What to include",
  "checklist.emptyHint":
    "Paste or type the customer's message. Include what happened, the amount and the 12-digit UTR from the bank SMS.",
  "checklist.progress": "{found} of {total} found",
  "checklist.optional": "optional",
  "checklist.openDetails": "Add in Details",
  "checklist.what": "What happened",
  "checklist.whatHint":
    "Say what went wrong: a failed payment, money sent to the wrong UPI ID, a scam call or QR request, or a debit the customer did not make.",
  "checklist.amount": "Amount",
  "checklist.amountHint": "Write the amount with ₹ or Rs, for example ₹2,500.",
  "checklist.utr": "UTR / reference number",
  "checklist.utrHint":
    "The 12-digit number with its label (UTR, Ref No or RRN). Failed payments have one too: check the debit SMS, the UPI app's transaction history, or the UPI/… line in the bank statement. If there is none, add the date, time and receiving UPI ID.",
  "checklist.when": "When it happened",
  "checklist.whenHint":
    "The transaction date or days since it happened, to check the reversal deadline and compensation.",
  "checklist.fraud": "Reporting delay and responsibility",
  "checklist.fraudHint":
    "How many working days before it was reported, and who was at fault, to assess liability.",
  "context.toggle": "Details (optional)",
  "context.delay": "Reporting delay · working days",
  "context.elapsed": "Elapsed · calendar days",
  "context.responsibility": "Responsibility · requires evidence",
  "context.responsibilityUnknown": "Unknown / unverified",
  "context.responsibilityBank": "Bank negligence · operator supplied",
  "context.responsibilityThirdParty": "Third-party breach · operator supplied",
  "context.responsibilityCustomer": "Customer negligence · operator supplied",
  "context.tier": "Account tier",
  "context.tierUnknown": "Unknown",
  "context.tierBsbd": "BSBD · ₹5,000 cap",
  "context.tierRegular": "Regular · ₹10,000 cap",
  "context.tierOther": "Other specified · ₹25,000 cap",
  "context.note":
    "Working days must use the bank’s calendar, excluding the date of receiving its alert. Context is operator-supplied, not independently verified.",

  "engine.title": "Triage intelligence",
  "engine.subtitle": "Evidence you can inspect.",
  "engine.live": "LIVE CHECKS",
  "engine.tabOverview": "Overview",
  "engine.tabJson": "JSON payload",
  "engine.tabProvenance": "Provenance",
  "engine.schemaVersion": "schema v1",
  "engine.validSchema": "Valid application schema",
  "engine.copyJson": "Copy JSON",
  "engine.inspectJson": "Inspect structured JSON",
  "engine.downloadPayload": "Download payload",
  "engine.jsonNote":
    "This is an internal triage contract. An approved mapping is needed before submitting to a bank or NPCI.",
  "engine.noStorage": "No messages stored",
  "engine.sourceRules": "Payload source: rules engine (no model configured)",
  "engine.sourceModel":
    "Payload source: {model} ({variant}) · passed strict validation · {ms} ms",
  "engine.sourceFallback":
    "Payload source: rules engine · model output rejected: {reasons}",
  "engine.sourceSkipped":
    "Payload source: rules engine · model not used: {reasons}",
  "engine.tierFromRules": "liability tier and actions set by policy rules",
  "engine.variantBase": "base model, not fine-tuned",
  "engine.variantAdapter": "fine-tuned adapter",
  "engine.variantPilot": "UNREVIEWED PILOT adapter, synthetic data, not for real decisions",

  "liability.timeline": "REVERSAL TIMELINE",
  "liability.assessment": "LIABILITY ASSESSMENT",
  "liability.verificationRequired": "Bank verification required",
  "liability.conditional":
    "Conditional eligibility · subject to bank investigation",
  "liability.responsible":
    "Authorisation and responsibility determine the outcome",
  "liability.deadline": "T+{days} calendar days",
  "liability.dailyPenalty": "₹100/day beyond T+{days} for a qualifying failure",
  "liability.compensation": "estimated delay compensation",
  "liability.dueBy": "Reversal due by {date}",
  "liability.overdue": "{days} days past the deadline",

  "transaction.amount": "Disputed amount",
  "transaction.notIdentified": "Not identified",
  "transaction.reference": "Transaction reference",
  "transaction.needsConfirmation": "Needs confirmation",
  "transaction.presentInSource": "Present in the source message",
  "transaction.uniqueRequired": "A unique labelled UTR is required",
  "transaction.classification": "Dispute classification",
  "transaction.internalTaxonomy": "/ internal taxonomy",

  "privacy.heading": "Privacy & provenance",
  "privacy.before": "BEFORE MODEL CONTEXT",
  "privacy.masked": "Sensitive fields masked",
  "privacy.noPatterns": "No supported PII patterns detected",
  "privacy.preserved": "Transaction reference preserved with context",
  "privacy.noVerified": "No unique verified reference",

  "checks.heading": "Verification checks",
  "checks.deterministic": "DETERMINISTIC",
  "checks.modelValidated": "MODEL · VALIDATED",
  "checks.schema": "Strict JSON schema",
  "checks.schemaDetail": "All required fields and types validated",
  "checks.provenance": "Transaction provenance",
  "checks.provenanceOk": "UTR matches the customer’s source message",
  "checks.provenanceBad": "Missing or conflicting UTR · review needed",
  "checks.guarantee": "No refund guarantee detected",
  "checks.guaranteeDetail": "Pattern check · human review still required",
  "checks.rails": "Relevant escalation rails",
  "checks.railsDetail": "Bank / PSP and fraud-reporting guidance",
  "checks.pass": "PASS",
  "checks.review": "REVIEW",
  "checks.humanTitle": "A human decision, supported.",

  "provenance.evidence": "Field-level evidence",
  "provenance.anchors": "{count} ANCHORS",
  "provenance.context": "Sanitized model context",
  "provenance.regex": "REGEX HYGIENE",
  "provenance.disclaimerTitle": "Provenance is not proof of authenticity.",
  "provenance.disclaimerBody":
    "Matching a reference to text does not verify the bank transaction. The regex scrubber detects supported patterns; Presidio is an optional research stage.",
  "provenance.export": "Export masked evidence trace",

  "teaser.eyebrow": "THE RESEARCH BEHIND THE DESK",
  "teaser.title": "Structure meets a little more understanding.",
  "teaser.body":
    "Explore specialist adapters, task arithmetic and the evaluation spine.",
  "teaser.cta": "Explore the pipeline",

  "pipeline.previous": "Previous stage",
  "pipeline.next": "Next stage",
  "pipeline.outputs": "WHAT THIS STAGE PRODUCES",
  "pipeline.note":
    "Each stage carries its source identity forward. Failed samples are recorded, repaired where justified, then checked again.",
  "pipeline.experimentEyebrow": "TASK-ARITHMETIC EXPERIMENT",
  "pipeline.experimentTitle": "Find the balance. Measure the result.",
  "pipeline.experimentBody":
    "The slider configures an offline merge. Model performance must be evaluated after merging.",
  "pipeline.specialistA": "Schema specialist",
  "pipeline.specialistB": "Empathy specialist",
  "pipeline.empathyOnly": "Empathy only",
  "pipeline.schemaOnly": "Schema only",
  "pipeline.resetMix": "Reset to 0.55 / 0.45",
  "pipeline.exportMix": "Export merge configuration",

  "bench.noteTitle": "The experiment is set up. The evidence comes next.",
  "bench.noteBody":
    "The proposal’s percentages and cost estimates have not been measured. This table will only contain results from identifiable evaluation runs.",
  "bench.notEvaluated": "NOT YET EVALUATED",
  "bench.ablation": "Checkpoint ablation",
  "bench.ablationBody":
    "All specialists and baselines, evaluated on the same held-out cases.",
  "bench.colCheckpoint": "CHECKPOINT",
  "bench.colSchema": "SCHEMA PASS",
  "bench.colFields": "FIELD EXACT MATCH",
  "bench.colUnsafe": "UNSAFE GUARANTEES",
  "bench.colEmpathy": "EMPATHY / CHRF",
  "bench.colStatus": "STATUS",
  "bench.awaitingRun": "Awaiting run",
  "bench.awaitingTraining": "Awaiting training",
  "bench.splitTitle": "Split by scenario family",
  "bench.splitBody":
    "Keep paraphrases, SMS templates and repaired versions of the same case in one split. Freeze the test set before selecting merge weights.",
  "bench.empathyTitle": "Empathy needs a human",
  "bench.empathyBody":
    "ChrF measures character overlap, not empathy or policy safety. Collect blinded regional-language ratings separately.",
  "bench.failureTitle": "Make failure observable",
  "bench.failureBody":
    "Report malformed JSON, fabricated UTRs, unsupported guarantees and missing escalation actions per case. Bootstrap paired differences.",
  "bench.adversarialEyebrow": "ADVERSARIAL SUITE",
  "bench.adversarialTitle": "Pressure should not change the policy.",
  "bench.adversarialBody":
    "Try a refund-coercion case against the current deterministic preview.",
  "bench.adversarialCta": "Open adversarial scenario",

  "policy.search": "Search sources, rules or institutions…",
  "policy.empty": "No matching sources",
  "policy.clear": "Clear search",
  "policy.disclaimerTitle": "A decision-support research tool.",
  "policy.disclaimerBody":
    "These sources inform the internal triage policy. This application is not a bank, regulator, official UDIR gateway or compliance certification. Review applicability and amendments before operational use.",

  "footer.tagline": "Thoughtful triage. Traceable decisions.",
  "footer.version": "Suraksha-Merge · Research preview v0.1",

  "mascot.hideHint": "Hide hint",
  "mascot.dismissHint": "Dismiss hint",
  "error.unavailable": "Triage is unavailable. Try again.",
  "error.connection": "Could not connect. Please try again.",

  "toast.copied": "Copied to clipboard",
  "toast.clipboardUnavailable":
    "Clipboard unavailable. You can select and copy the text.",
  "toast.traceExported": "Masked provenance trace exported",

  "landing.home": "HOME",
  "landing.howItWorks": "HOW IT WORKS",
  "landing.features": "FEATURES",
  "landing.faq": "FAQ",
  "landing.github": "GITHUB",
  "landing.openDesk": "OPEN DESK",
  "landing.heroEyebrow": "SURAKSHA-MERGE",
  "landing.heroTitleLine1": "YOUR PAYMENT",
  "landing.heroTitleLine2": "SECURITY",
  "landing.heroDescriptionLine1": "NOISY MESSAGES. CLEAR NEXT STEPS.",
  "landing.heroDescriptionLine2": "FRAUD TRIAGE WITH EVIDENCE — AND EMPATHY.",
  "landing.heroCta": "EXPLORE THE DESK",
  "landing.heroMode": "WORKING RULE-BASED PREVIEW",
  "landing.heroModeDivider": "RESEARCH MODEL · SYNTHETIC DATA",
  "landing.featuresTitle": "SECURITY, WITH A HUMAN SIDE",
  "landing.feature1Title": "PRIVATE BY DESIGN",
  "landing.feature1Body": "Context-aware PII masking",
  "landing.feature2Title": "BUILT ON EVIDENCE",
  "landing.feature2Body": "Traceable structured triage",
  "landing.feature3Title": "CARE IN EVERY REPLY",
  "landing.feature3Body": "Empathetic customer drafts",
  "landing.artTitle": "ONE MESSAGE. A CLEARER NEXT STEP.",
  "landing.artCaption": "CuratorKIT → AlignTune → AuditKIT",
  "landing.artButton": "Explore how the pipeline works",
  "landing.illustrationLabel":
    "Illustration of a customer protected by a lock and source-grounded transaction records",
  "landing.illustrationTag": "EVIDENCE, FIRST.",
  "landing.illustrationTagBody": "Every field has a source.",
  "landing.approachKicker": "THE SURAKSHA APPROACH / 01",
  "landing.approachTitleLine1": "LESS PANIC.",
  "landing.approachTitleLine2": "MORE CLARITY.",
  "landing.approachBody1":
    "A collect-request scam. A payment that never arrived. A customer who needs help in their own words.",
  "landing.approachBody2":
    "SurakshaDesk brings the message, the transaction evidence and the next steps into one reviewable workspace. Explore the live preview, then follow the research pipeline behind it.",
  "landing.followPipeline": "FOLLOW THE PIPELINE",
  "landing.contextKicker": "A LITTLE MORE CONTEXT / 02",
  "landing.faqTitleLine1": "GOOD QUESTIONS.",
  "landing.faqTitleLine2": "STRAIGHT ANSWERS.",
  "landing.faq1Question": "Is this a trained fraud detection model?",
  "landing.faq1Answer":
    "Not a production model. The desk always runs deterministic extraction, policy rules and reply templates. A fine-tuned Qwen2.5-3B, trained on human-reviewed synthetic cases in English, Hindi and Hinglish, can be connected: it reads the facts and the category, the policy rules decide the liability tier, actions and reply language, and the rules answer whenever its output fails a check. It has not been evaluated on real customer messages.",
  "landing.faq2Question": "Does this file a dispute or approve a refund?",
  "landing.faq2Answer":
    "The desk prepares a draft for review. It has no bank or NPCI connection and takes no external action. Actual disputes must be raised through the bank or PSP app.",
  "landing.faq3Question": "Where do the policy rules come from?",
  "landing.faq3Answer":
    "Versioned RBI and NPCI sources inform the internal policy. Eligibility depends on verified facts and the applicable framework.",
  "landing.policyLink": "Read the policy library ↗",
  "landing.faq4Question": "Can I inspect the source and evaluation plan?",
  "landing.faq4Answer":
    "Yes. The project is public on GitHub. The benchmark lab lists all six planned checkpoints and keeps their scores blank until measured runs exist.",
  "landing.footerTagline": "THOUGHTFUL TRIAGE. TRACEABLE DECISIONS.",
  "landing.openWorkspace": "OPEN THE WORKSPACE",
} as const;

export type MessageKey = keyof typeof en;

const hi: Record<MessageKey, string> = {
  "intake.sourceMessage": "जाँचा गया ग्राहक संदेश देखें",
  "composer.shortcut": "चलाने के लिए Ctrl / ⌘ + Enter",
  "composer.transactionDate": "लेनदेन की तारीख़",
  "composer.autoDetect": "भाषा स्वतः पहचानें",
  "composer.voiceError":
    "आवाज़ की पहचान पूरी नहीं हुई। पुनः प्रयास करें या संदेश लिखें।",

  "desk.staleTitle": "जानकारी बदल गई है। निर्णय फिर से जाँचें।",
  "desk.staleBody":
    "दिख रहा उत्तर और नीति आकलन पिछली जानकारी का है। कॉपी या निर्यात से पहले ट्रायेज फिर चलाएँ।",
  "desk.runningTitle": "संदेश और उसके प्रमाण जाँचे जा रहे हैं…",
  "desk.runningBody": "नया आकलन तैयार होने तक पिछला परिणाम दिख रहा है।",
  "composer.apiKey": "सेवा की API कुंजी",
  "composer.apiKeyHint":
    "केवल इस सत्र के अनुरोध में उपयोग होगी। इसे सहेजा या निर्यात नहीं किया जाता।",
  "composer.replyLanguage": "ग्राहक के उत्तर की भाषा",
  "error.unauthorized":
    "इस सेवा के लिए API कुंजी आवश्यक है। नीचे कुंजी भरें और पुनः प्रयास करें।",
  "error.rateLimited": "बहुत अधिक अनुरोध हुए। एक मिनट बाद पुनः प्रयास करें।",
  "error.timeout":
    "अनुरोध की समय-सीमा समाप्त हुई। आपका संदेश सुरक्षित है; फिर प्रयास करें।",
  "error.invalidInput": "संदेश और ऑपरेटर की जानकारी जाँचकर पुनः प्रयास करें।",
  "error.tooLarge": "संदेश बहुत बड़ा है। इसे 12,000 अक्षरों से कम रखें।",
  "error.invalidResponse": "सेवा का उत्तर अधूरा है। पुनः प्रयास करें।",

  "nav.brandHome": "सुरक्षा डेस्क होम",
  "nav.brandTagline": "स्पष्टता। देखभाल। विश्वास।",
  "nav.workspace": "शोध कार्यक्षेत्र",
  "nav.workspaceName": "सुरक्षा-मर्ज",
  "nav.section": "कार्यक्षेत्र",
  "nav.triageDesk": "ट्रायेज डेस्क",
  "nav.pipeline": "पाइपलाइन एक्सप्लोरर",
  "nav.benchmarks": "बेंचमार्क प्रयोगशाला",
  "nav.policy": "नीति पुस्तकालय",
  "nav.trustTitle": "विश्वास पर आधारित।",
  "nav.trustBody":
    "हर निकाला गया फ़ील्ड प्रमाण चाहता है। हर वादा संयम चाहता है।",
  "nav.trustLink": "नीति की रीढ़ देखें",
  "nav.viewSource": "स्रोत देखें",
  "nav.operator": "शोध संचालक",
  "nav.operatorDemo": "डेमो कार्यक्षेत्र",
  "nav.breadcrumbRoot": "कार्यक्षेत्र",
  "nav.interfaceLanguage": "इंटरफ़ेस की भाषा",

  "topbar.engine": "नियम-आधारित इंजन सक्रिय",
  "topbar.engineModel": "पायलट मॉडल · नियम बैकअप",
  "topbar.engineTrained": "फ़ाइन-ट्यून मॉडल · नियम बैकअप",
  "topbar.research": "शोध पूर्वावलोकन",

  "common.exportTrace": "ट्रेस निर्यात करें",
  "common.exportConfiguration": "कॉन्फ़िगरेशन निर्यात करें",
  "common.dismiss": "सूचना बंद करें",
  "common.retry": "फिर कोशिश करें",
  "common.reset": "रीसेट",
  "common.skipToContent": "मुख्य सामग्री पर जाएँ",

  "desk.eyebrow": "सुरक्षा-मर्ज / संचालन",
  "desk.title": "एक स्पष्ट अगला कदम।",
  "desk.subtitle":
    "चिंतित ग्राहक के संदेश को संरचित, विचारशील कार्यवाही में बदलें।",
  "desk.pipelineTitle": "एक पाइपलाइन। दो विशेषज्ञ।",
  "desk.pipelineSubtitle":
    "शोरगुल वाले संदेश से सत्यापन योग्य जवाब तक का रास्ता देखें।",
  "desk.benchmarksTitle": "विश्वास से पहले प्रमाण।",
  "desk.benchmarksSubtitle":
    "छह चेकपॉइंट। एक होल्ड-आउट बेंचमार्क। कोई बनावटी नतीजे नहीं।",
  "desk.policyTitle": "नियमों पर आधारित।",
  "desk.policySubtitle":
    "हर ट्रायेज सिफ़ारिश के पीछे संस्करणबद्ध प्राथमिक स्रोत।",

  "workflow.message": "ग्राहक संदेश",
  "workflow.privacy": "निजता और प्रमाण",
  "workflow.structured": "संरचित ट्रायेज",
  "workflow.draft": "ग्राहक ड्राफ़्ट",
  "workflow.label": "एक ऑडिट योग्य प्रवाह",

  "intake.title": "ग्राहक चैनल",
  "intake.subtitle": "शोरगुल वाले संदेश। इंसानी कहानियाँ।",
  "intake.demoBadge": "सिंथेटिक डेमो",
  "intake.tryScenario": "एक परिदृश्य आज़माएँ",
  "intake.latestTriage": "नवीनतम ट्रायेज",
  "intake.scenarioPreview": "परिदृश्य पूर्वावलोकन",
  "intake.unrunChanges": "बदलाव बाकी हैं — ट्रायेज चलाएँ",
  "intake.customer": "ग्राहक",
  "intake.draft": "सुरक्षा ड्राफ़्ट",
  "intake.forReview": "समीक्षा हेतु",
  "intake.machineTranslated": "मशीन अनुवाद · मूल भाषी समीक्षा आवश्यक",
  "intake.copyReply": "ग्राहक उत्तर कॉपी करें",
  "intake.maskPii": "मूल संदेश कुछ पल दिखाएँ",
  "intake.revealRaw": "मूल संदेश दिखाएँ",
  "intake.revealed": "मूल संदेश अभी छिपाएँ",
  "intake.urgency": "{severity} तीव्रता",
  "intake.escalation": "आगे बढ़ाने का तरीका",
  "intake.draftFooter": "ड्राफ़्ट तैयार · कोई बाहरी कार्रवाई नहीं",

  "composer.heading": "अपनी भाषा में लिखें",
  "composer.placeholder":
    "हिंग्लिश, तंग्लिश, मराठी या अंग्रेज़ी में ग्राहक संदेश चिपकाएँ…",
  "composer.run": "ट्रायेज चलाएँ",
  "composer.running": "विश्लेषण हो रहा है…",
  "composer.dictate": "बोलकर लिखें",
  "composer.listening": "सुन रहा है…",
  "composer.stop": "रोकें",
  "composer.voiceUnsupported":
    "इस ब्राउज़र में वॉइस इनपुट समर्थित नहीं है। संदेश चिपकाकर लिखें।",
  "composer.voiceDenied":
    "माइक्रोफ़ोन की अनुमति नहीं मिली। संदेश चिपकाकर लिखें।",
  "composer.voiceEmpty": "कोई बोला हुआ वाक्य नहीं मिला। दोबारा कोशिश करें।",
  "composer.languageHint":
    "उत्तर उसी भाषा में लिखा जाएगा जो आपके संदेश से पहचानी गई।",

  "composer.voiceConsent":
    "डिक्टेशन आपके ब्राउज़र की स्पीच सेवा का उपयोग करता है, जो ऑडियो ब्राउज़र कंपनी के सर्वर पर भेज सकती है (Chrome इसे Google को भेजता है)। असली ग्राहक डेटा न बोलें।",
  "composer.voiceConsentAccept": "फिर भी बोलकर लिखें",
  "composer.voiceConsentCancel": "रद्द करें",
  "composer.screenshot": "स्क्रीनशॉट पढ़ें",
  "composer.screenshotReading": "पढ़ रहे हैं…",
  "composer.screenshotHint":
    "बैंक SMS या UPI रसीद के स्क्रीनशॉट का टेक्स्ट जोड़ें। इसे इसी डिवाइस पर पढ़ा जाता है; तस्वीर अपलोड नहीं होती।",
  "composer.screenshotError": "यह तस्वीर पढ़ी नहीं जा सकी। 8 MB से छोटी PNG, JPEG या WebP इस्तेमाल करें।",
  "composer.screenshotEmpty": "इस तस्वीर में कोई टेक्स्ट नहीं मिला।",
  "checklist.title": "क्या शामिल करें",
  "checklist.emptyHint":
    "ग्राहक का संदेश यहाँ लिखें या पेस्ट करें। क्या हुआ, राशि और बैंक SMS का 12 अंकों वाला UTR शामिल करें।",
  "checklist.progress": "{total} में से {found} मिले",
  "checklist.optional": "वैकल्पिक",
  "checklist.openDetails": "विवरण में जोड़ें",
  "checklist.what": "क्या हुआ",
  "checklist.whatHint":
    "बताएँ क्या गलत हुआ: असफल भुगतान, गलत UPI ID पर पैसे भेजे गए, धोखाधड़ी वाली कॉल या QR अनुरोध, या ऐसा डेबिट जो ग्राहक ने नहीं किया।",
  "checklist.amount": "राशि",
  "checklist.amountHint": "राशि ₹ या Rs के साथ लिखें, जैसे ₹2,500।",
  "checklist.utr": "UTR / संदर्भ संख्या",
  "checklist.utrHint":
    "12 अंकों वाला नंबर, उसके लेबल के साथ (UTR, Ref No या RRN)। असफल भुगतान का भी होता है: debit SMS, UPI ऐप की transaction history, या bank statement की UPI/… वाली लाइन देखें। न मिले तो तारीख, समय और पाने वाले की UPI ID जोड़ें।",
  "checklist.when": "कब हुआ",
  "checklist.whenHint":
    "लेनदेन की तारीख या कितने दिन बीते, ताकि रिवर्सल की समय-सीमा और मुआवज़ा जाँचा जा सके।",
  "checklist.fraud": "रिपोर्ट में देरी और ज़िम्मेदारी",
  "checklist.fraudHint":
    "रिपोर्ट करने में कितने कार्य दिवस लगे और गलती किसकी थी, ताकि देनदारी आँकी जा सके।",
  "context.toggle": "विवरण (वैकल्पिक)",
  "context.delay": "रिपोर्ट में देरी · कार्य दिवस",
  "context.elapsed": "बीत गए दिन · कैलेंडर दिवस",
  "context.responsibility": "ज़िम्मेदारी · प्रमाण आवश्यक",
  "context.responsibilityUnknown": "अज्ञात / असत्यापित",
  "context.responsibilityBank": "बैंक की लापरवाही · ऑपरेटर द्वारा दी गई",
  "context.responsibilityThirdParty":
    "तृतीय पक्ष की गड़बड़ी · ऑपरेटर द्वारा दी गई",
  "context.responsibilityCustomer": "ग्राहक की लापरवाही · ऑपरेटर द्वारा दी गई",
  "context.tier": "खाता श्रेणी",
  "context.tierUnknown": "अज्ञात",
  "context.tierBsbd": "BSBD · ₹5,000 सीमा",
  "context.tierRegular": "सामान्य · ₹10,000 सीमा",
  "context.tierOther": "अन्य निर्दिष्ट · ₹25,000 सीमा",
  "context.note":
    "कार्य दिवस बैंक के कैलेंडर से गिने जाएँ, और बैंक के पत्र की प्राप्ति की तारीख़ को शामिल न करें। संदर्भ ऑपरेटर द्वारा दिया गया है, स्वतः सत्यापित नहीं।",

  "engine.title": "ट्रायेज इंटेलिजेंस",
  "engine.subtitle": "प्रमाण जो आप देख सकते हैं।",
  "engine.live": "लाइव जाँच",
  "engine.tabOverview": "सारांश",
  "engine.tabJson": "JSON पेलोड",
  "engine.tabProvenance": "प्रमाण-श्रृंखला",
  "engine.schemaVersion": "स्कीमा v1",
  "engine.validSchema": "मान्य एप्लिकेशन स्कीमा",
  "engine.copyJson": "JSON कॉपी करें",
  "engine.inspectJson": "संरचित JSON देखें",
  "engine.downloadPayload": "पेलोड डाउनलोड करें",
  "engine.jsonNote":
    "यह एक आंतरिक ट्रायेज अनुबंध है। बैंक या NPCI को भेजने से पहले स्वीकृत मैपिंग आवश्यक है।",
  "engine.noStorage": "कोई संदेश संग्रहित नहीं होता",
  "engine.sourceRules": "पेलोड स्रोत: नियम इंजन (कोई मॉडल कॉन्फ़िगर नहीं)",
  "engine.sourceModel":
    "पेलोड स्रोत: {model} ({variant}) · सख़्त सत्यापन पास · {ms} ms",
  "engine.sourceFallback":
    "पेलोड स्रोत: नियम इंजन · मॉडल आउटपुट अस्वीकृत: {reasons}",
  "engine.sourceSkipped":
    "पेलोड स्रोत: नियम इंजन · मॉडल उपयोग नहीं हुआ: {reasons}",
  "engine.tierFromRules": "देनदारी श्रेणी और कदम नीति नियमों द्वारा तय",
  "engine.variantBase": "बेस मॉडल, फ़ाइन-ट्यून नहीं",
  "engine.variantAdapter": "फ़ाइन-ट्यून एडेप्टर",
  "engine.variantPilot": "असमीक्षित पायलट एडेप्टर, सिंथेटिक डेटा, वास्तविक निर्णयों के लिए नहीं",

  "liability.timeline": "उलटी समय-सीमा",
  "liability.assessment": "दायित्व आकलन",
  "liability.verificationRequired": "बैंक से सत्यापन आवश्यक",
  "liability.conditional": "सशर्त पात्रता · बैंक की जाँच के अधीन",
  "liability.responsible": "प्राधिकरण और ज़िम्मेदारी ही परिणाम तय करते हैं",
  "liability.deadline": "T+{days} कैलेंडर दिन",
  "liability.dailyPenalty": "योग्य विफलता पर T+{days} के बाद ₹100/दिन",
  "liability.compensation": "अनुमानित विलंब मुआवज़ा",
  "liability.dueBy": "रिवर्सल की अंतिम तिथि {date}",
  "liability.overdue": "समय-सीमा से {days} दिन ऊपर",

  "transaction.amount": "विवादित राशि",
  "transaction.notIdentified": "पहचाना नहीं गया",
  "transaction.reference": "लेनदेन संदर्भ",
  "transaction.needsConfirmation": "पुष्टि आवश्यक",
  "transaction.presentInSource": "स्रोत संदेश में मौजूद",
  "transaction.uniqueRequired": "एक अलग पहचाना गया UTR आवश्यक है",
  "transaction.classification": "विवाद वर्गीकरण",
  "transaction.internalTaxonomy": "/ आंतरिक वर्गीकरण",

  "privacy.heading": "निजता और प्रमाण",
  "privacy.before": "मॉडल संदर्भ से पहले",
  "privacy.masked": "संवेदनशील फ़ील्ड छिपाए गए",
  "privacy.noPatterns": "कोई समर्थित PII पैटर्न नहीं मिला",
  "privacy.preserved": "लेनदेन संदर्भ संदर्भ-सहित सुरक्षित रखा गया",
  "privacy.noVerified": "कोई अलग सत्यापित संदर्भ नहीं",

  "checks.heading": "सत्यापन जाँच",
  "checks.deterministic": "नियतात्मक",
  "checks.modelValidated": "मॉडल · सत्यापित",
  "checks.schema": "कठोर JSON स्कीमा",
  "checks.schemaDetail": "सभी आवश्यक फ़ील्ड और प्रकार सत्यापित",
  "checks.provenance": "लेनदेन प्रमाण",
  "checks.provenanceOk": "UTR ग्राहक के स्रोत संदेश से मेल खाता है",
  "checks.provenanceBad": "UTR नहीं मिला या टकराव है · समीक्षा आवश्यक",
  "checks.guarantee": "किसी अनधिकृत वादे का पता नहीं चला",
  "checks.guaranteeDetail": "पैटर्न जाँच · मानव समीक्षा फिर भी आवश्यक",
  "checks.rails": "प्रासंगिक एस्केलेशन मार्ग",
  "checks.railsDetail": "बैंक / PSP और धोखाधड़ी रिपोर्टिंग मार्गदर्शन",
  "checks.pass": "उत्तीर्ण",
  "checks.review": "समीक्षा",
  "checks.humanTitle": "मानव निर्णय, प्रमाण के साथ।",

  "provenance.evidence": "फ़ील्ड-स्तरीय प्रमाण",
  "provenance.anchors": "{count} आँकर",
  "provenance.context": "सुरक्षित मॉडल संदर्भ",
  "provenance.regex": "रेगेक्स स्वच्छता",
  "provenance.disclaimerTitle":
    "प्रमाण-श्रृंखला प्रामाणिकता का प्रमाण नहीं है।",
  "provenance.disclaimerBody":
    "किसी संदर्भ का पाठ से मेल खलना बैंक लेनदेन की पुष्टि नहीं करता। रेगेक्स स्क्रबर समर्थित पैटर्न पहचानता है; Presidio एक वैकल्पिक शोध चरण है।",
  "provenance.export": "संवेदनशील-रहित प्रमाण ट्रेस निर्यात करें",

  "teaser.eyebrow": "डेस्क के पीछे का शोध",
  "teaser.title": "संरचना के साथ थोड़ी समझ भी।",
  "teaser.body": "विशेषज्ञ अडैप्टर, टास्क अरिथमेटिक और मूल्यांकन ढाँचा देखें।",
  "teaser.cta": "पाइपलाइन देखें",

  "pipeline.previous": "पिछला चरण",
  "pipeline.next": "अगला चरण",
  "pipeline.outputs": "यह चरण क्या बनाता है",
  "pipeline.note":
    "हर चरण अपनी स्रोत पहचान आगे बढ़ाता है। विफल नमूने दर्ज होते हैं, जहाँ उचित हो सुधारे जाते हैं, फिर दोबारा जाँचे जाते हैं।",
  "pipeline.experimentEyebrow": "टास्क-अरिथमेटिक प्रयोग",
  "pipeline.experimentTitle": "संतुलन खोजें। परिणाम मापें।",
  "pipeline.experimentBody":
    "स्लाइडर एक ऑफ़लाइन मर्ज को कॉन्फ़िगर करता है। मर्ज के बाद मॉडल का प्रदर्शन मापा जाना चाहिए।",
  "pipeline.specialistA": "स्कीमा विशेषज्ञ",
  "pipeline.specialistB": "सहानुभूति विशेषज्ञ",
  "pipeline.empathyOnly": "केवल सहानुभूति",
  "pipeline.schemaOnly": "केवल स्कीमा",
  "pipeline.resetMix": "0.55 / 0.45 पर रीसेट करें",
  "pipeline.exportMix": "मर्ज कॉन्फ़िगरेशन निर्यात करें",

  "bench.noteTitle": "प्रयोग तैयार है। प्रमाण आने बाकी हैं।",
  "bench.noteBody":
    "प्रस्ताव के प्रतिशत और लागत अनुमान मापे नहीं गए हैं। यह तालिका केवल पहचाने जा सकने वाले मूल्यांकन पर runs से भरेगी।",
  "bench.notEvaluated": "अभी मूल्यांकन नहीं हुआ",
  "bench.ablation": "चेकपॉइंट अब्लेशन",
  "bench.ablationBody": "सभी विशेषज्ञ और आधार रेखाएँ, एक ही होल्ड-आउट केस पर।",
  "bench.colCheckpoint": "चेकपॉइंट",
  "bench.colSchema": "स्कीमा उत्तीर्ण",
  "bench.colFields": "फ़ील्ड सटीक मिलान",
  "bench.colUnsafe": "असुरक्षित वादे",
  "bench.colEmpathy": "सहानुभूति / CHRF",
  "bench.colStatus": "स्थिति",
  "bench.awaitingRun": "run की प्रतीक्षा",
  "bench.awaitingTraining": "प्रशिक्षण की प्रतीक्षा",
  "bench.splitTitle": "परिदृश्य परिवार के अनुसार विभाजन",
  "bench.splitBody":
    "एक ही केस के पुनरावृत्त रूप, SMS टेम्पलेट और सुधरे हुए संस्करण एक ही विभाजन में रखें। मर्ज वज़न चुनने से पहले टेस्ट सेट को जमा कर दें।",
  "bench.empathyTitle": "सहानुभूति के लिए मानव चाहिए",
  "bench.empathyBody":
    "ChrF अक्षर-मिलान मापता है, सहानुभूति या नीति-सुरक्षा नहीं। क्षेत्रीय भाषाओं में अलग से आँखें बंद करके रेटिंग लें।",
  "bench.failureTitle": "विफलता को दिखाई दें",
  "bench.failureBody":
    "हर केस के लिए खराब JSON, बनावटी UTR, असमर्थित वादे और छूटे एस्केलेशन कार्रवाइयाँ दर्ज करें। युग्मित अंतरों का बूटस्ट्रैप करें।",
  "bench.adversarialEyebrow": "प्रतिकूल परीक्षण",
  "bench.adversarialTitle": "दबाव नीति नहीं बदलना चाहिए।",
  "bench.adversarialBody":
    "नियतात्मक पूर्वावलोकन के विरुद्ध रिफ़ंड-दबाव वाला केस आज़माएँ।",
  "bench.adversarialCta": "प्रतिकूल परिदृश्य खोलें",

  "policy.search": "स्रोत, नियम या संस्थाएँ खोजें…",
  "policy.empty": "कोई मिलता-जुलता स्रोत नहीं",
  "policy.clear": "खोज साफ़ करें",
  "policy.disclaimerTitle": "एक निर्णय-सहायता शोध उपकरण।",
  "policy.disclaimerBody":
    "ये स्रोत आंतरिक ट्रायेज नीति को सूचित करते हैं। यह अनुप्रयोग बैंक, नियामक, आधिकारिक UDIR गेटवे या अनुपालन प्रमाणन नहीं है। परिचालन से पहले प्रासंगिकता और संशोधन जाँचें।",

  "footer.tagline": "विचारशील ट्रायेज। ट्रेस योग्य निर्णय।",
  "footer.version": "सुरक्षा-मर्ज · शोध पूर्वावलोकन v0.1",

  "mascot.hideHint": "सुझाव छिपाएँ",
  "mascot.dismissHint": "सुझाव हटाएँ",
  "error.unavailable": "ट्रायेज उपलब्ध नहीं है। फिर कोशिश करें।",
  "error.connection": "कनेक्ट नहीं हो सका। कृपया फिर कोशिश करें।",

  "toast.copied": "क्लिपबोर्ड पर कॉपी हो गया",
  "toast.clipboardUnavailable":
    "क्लिपबोर्ड उपलब्ध नहीं। आप पाठ चुनकर कॉपी कर सकते हैं।",
  "toast.traceExported": "संवेदनशील-रहित प्रमाण ट्रेस निर्यात हुआ",

  "landing.home": "होम",
  "landing.howItWorks": "यह कैसे काम करता है",
  "landing.features": "विशेषताएँ",
  "landing.faq": "सवाल-जवाब",
  "landing.github": "गिटहब",
  "landing.openDesk": "डेस्क खोलें",
  "landing.heroEyebrow": "सुरक्षा-मर्ज",
  "landing.heroTitleLine1": "आपके भुगतान की",
  "landing.heroTitleLine2": "सुरक्षा",
  "landing.heroDescriptionLine1": "शोरगुल वाले संदेश। स्पष्ट अगला कदम।",
  "landing.heroDescriptionLine2":
    "प्रमाण के साथ धोखाधड़ी ट्रायेज — और सहानुभूति।",
  "landing.heroCta": "डेस्क देखें",
  "landing.heroMode": "कार्यशील नियम-आधारित पूर्वावलोकन",
  "landing.heroModeDivider": "शोध मॉडल · सिंथेटिक डेटा",
  "landing.featuresTitle": "सुरक्षा, मानवीय पक्ष के साथ",
  "landing.feature1Title": "गोपनीयता ही डिज़ाइन",
  "landing.feature1Body": "संदर्भ-आधारित PII मास्किंग",
  "landing.feature2Title": "प्रमाण पर आधारित",
  "landing.feature2Body": "ट्रेस योग्य संरचित ट्रायेज",
  "landing.feature3Title": "हर उत्तर में सहानुभूति",
  "landing.feature3Body": "सहानुभूतिपूर्ण ग्राहक ड्राफ़्ट",
  "landing.artTitle": "एक संदेश। एक स्पष्ट अगला कदम।",
  "landing.artCaption": "CuratorKIT → AlignTune → AuditKIT",
  "landing.artButton": "पाइपलाइन कैसे काम करती है देखें",
  "landing.illustrationLabel":
    "ताला और स्रोत-आधारित लेनदेन रिकॉर्ड से सुरक्षित ग्राहक का चित्रण",
  "landing.illustrationTag": "पहले प्रमाण।",
  "landing.illustrationTagBody": "हर फ़ील्ड का एक स्रोत है।",
  "landing.approachKicker": "सुरक्षा का दृष्टिकोण / 01",
  "landing.approachTitleLine1": "कम घबराहट।",
  "landing.approachTitleLine2": "ज़्यादा स्पष्टता।",
  "landing.approachBody1":
    "एक कलेक्ट-रिक्वेस्ट ठगी। एक ऐसा भुगतान जो कभी नहीं पहुँचा। एक ग्राहक जिसे अपनी ही भाषा में मदद चाहिए।",
  "landing.approachBody2":
    "सुरक्षा डेस्क संदेश, लेनदेन प्रमाण और अगले कदमों को एक जाँचने योग्य कार्यक्षेत्र में लाता है। पहले लाइव पूर्वावलोकन देखें, फिर उसके पीछे का शोध पाइपलाइन।",
  "landing.followPipeline": "पाइपलाइन देखें",
  "landing.contextKicker": "थोड़ा और संदर्भ / 02",
  "landing.faqTitleLine1": "अच्छे सवाल।",
  "landing.faqTitleLine2": "सीधे जवाब।",
  "landing.faq1Question": "क्या यह प्रशिक्षित धोखाधड़ी-पहचान मॉडल है?",
  "landing.faq1Answer":
    "यह प्रोडक्शन मॉडल नहीं है। डेस्क हमेशा नियतात्मक निष्कर्ष, नीति नियम और उत्तर-टेम्पलेट चलाता है। अंग्रेज़ी, हिंदी और हिंग्लिश के मानव-समीक्षित सिंथेटिक मामलों पर फ़ाइन-ट्यून Qwen2.5-3B जोड़ा जा सकता है: वह तथ्य और श्रेणी पढ़ता है, देनदारी श्रेणी, कदम और उत्तर की भाषा नीति नियम तय करते हैं, और उसका आउटपुट किसी जाँच में विफल हो तो नियम उत्तर देते हैं। इसे असली ग्राहक संदेशों पर नहीं परखा गया है।",
  "landing.faq2Question":
    "क्या यह विवाद दर्ज करता है या रिफ़ंड मंज़ूर करता है?",
  "landing.faq2Answer":
    "डेस्क समीक्षा हेतु ड्राफ़्ट तैयार करता है। इसका बैंक या NPCI से कोई जुड़ाव नहीं है और यह कोई बाहरी कार्रवाई नहीं करता। वास्तविक विवाद बैंक या PSP ऐप से दर्ज करें।",
  "landing.faq3Question": "नीति नियम कहाँ से आते हैं?",
  "landing.faq3Answer":
    "संस्करणबद्ध RBI और NPCI स्रोत आंतरिक नीति को सूचित करते हैं। पात्रता सत्यापित तथ्यों और लागू ढाँचे पर निर्भर है।",
  "landing.policyLink": "नीति पुस्तकालय पढ़ें ↗",
  "landing.faq4Question": "क्या मैं स्रोत और मूल्यांकन योजना देख सकता हूँ?",
  "landing.faq4Answer":
    "हाँ। परियोजना गिटहब पर सार्वजनिक है। बेंचमार्क प्रयोगशाला सभी छह नियोजित चेकपॉइंट दिखाती है और मापे गए runs तक उनके अंक खाली रखती है।",
  "landing.footerTagline": "विचारशील ट्रायेज। ट्रेस योग्य निर्णय।",
  "landing.openWorkspace": "कार्यक्षेत्र खोलें",
};

/**
 * A generated locale: the interface catalog plus translations of the content
 * modules' English prose (see lib/i18n/generated/, scripts/translate_i18n.py).
 */
export type LocaleBundle = {
  messages: Record<MessageKey, string>;
  content: Record<string, string>;
};

/** Generated locales load on demand so the bundle carries only English and Hindi. */
export const LOCALE_LOADERS = GENERATED_LOCALE_LOADERS;

export const catalogs: Partial<Record<UiLocale, Record<MessageKey, string>>> = {
  en,
  hi,
};

export function isLocaleLoaded(locale: UiLocale): boolean {
  return Boolean(catalogs[locale]);
}

/** Load a generated locale's catalog and content table. Idempotent. */
export async function loadLocale(locale: UiLocale): Promise<void> {
  if (catalogs[locale]) return;
  const loader = LOCALE_LOADERS[locale];
  if (!loader) return; // not generated yet: the interface stays in English
  const { default: bundle } = await loader();
  catalogs[locale] = bundle.messages;
  registerContent(locale, bundle.content);
}

/** The English source catalog, for the translation pipeline. */
export const SOURCE_CATALOG: Record<MessageKey, string> = en;

export type MessageVars = Record<string, string | number>;

/** Replace {token} placeholders. Unknown tokens are left untouched. */
export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function translate(
  locale: UiLocale,
  key: MessageKey,
  vars?: MessageVars,
): string {
  // A locale that is still loading renders in English for a moment.
  const template = catalogs[locale]?.[key] ?? en[key];
  return interpolate(template, vars);
}
