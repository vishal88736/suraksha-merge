"""Deterministic, explicitly unreviewed UPI scenario specifications.

Targets come from authored facts, not predictions of the application engine.
All translations, evidence variants and policy counterfactuals of one family
stay together. These templates are bootstrap coverage, not independent gold.
"""
from research.dataset_quality import target_from_facts

LANGUAGES=['english','hindi_devanagari','hinglish','tanglish','marathi_english']
FAMILIES={
'P2M_CONFIRMATION_FAILURE':[
 ('fuel-terminal','fuel station terminal'),('clinic-counter','clinic billing desk'),('canteen-token','canteen token counter'),('cinema-booking','cinema booking checkout'),('bookshop-order','bookshop order'),('parking-barrier','parking payment barrier'),('grocery-till','grocery till'),('pharmacy-receipt','pharmacy receipt counter'),('bus-ticket','bus ticket checkout'),('college-fee-portal','college fee merchant portal')],
'P2P_BENEFICIARY_NOT_CREDITED':[
 ('family-remittance','family remittance'),('shared-rent','shared rent contribution'),('tuition-repayment','tuition repayment to a friend'),('emergency-help','emergency help transfer'),('travel-split','travel expense split'),('meal-share','meal reimbursement'),('festival-gift','festival gift transfer'),('society-contribution','society contribution transfer'),('vendor-personal-refund','personal repayment from a friend'),('savings-transfer','transfer between my own bank accounts')],
'COLLECT_REQUEST_SCAM':[
 ('rental-token','rental token refund pretext'),('cashback-request','cashback release pretext'),('delivery-adjustment','delivery charge adjustment'),('job-bond-refund','job bond refund'),('event-cancellation','event cancellation refund'),('donation-return','donation return request'),('appliance-resale','used appliance buyer'),('subscription-credit','subscription credit release'),('travel-voucher','travel voucher refund'),('market-deposit','marketplace security deposit refund')],
'REMOTE_ACCESS_SCAM':[
 ('kyc-helper','KYC helper impersonation'),('courier-rescheduler','courier rescheduling caller'),('tax-support','tax support caller'),('insurance-support','insurance support caller'),('pension-verifier','pension verification caller'),('broadband-technician','broadband technician impersonation'),('refund-desk','refund desk impersonation'),('electricity-support','electricity support caller'),('bank-update','bank update caller'),('wallet-repair','UPI wallet repair caller')],
'VOLUNTARY_WRONG_VPA_TRANSFER':[
 ('contact-autofill','contact autofill selection'),('vpa-typo','one-letter VPA typing mistake'),('old-contact','old saved UPI contact'),('similar-name','recipient with a similar name'),('clipboard-paste','incorrect clipboard paste'),('beneficiary-selection','beneficiary selection mistake'),('phone-contact','wrong phone contact selection'),('family-contact','mistaken family contact selection'),('address-suffix','incorrect VPA suffix'),('repeat-contact','wrong saved repeat-payment contact')],
'UNAUTHORIZED_ACCOUNT_TAKEOVER':[
 ('unknown-device','unknown device login'),('lost-sim-session','stolen SIM session'),('night-debit','unexpected overnight debit'),('stolen-phone','stolen phone report'),('credential-compromise','reported credential compromise'),('unrecognized-login','unrecognized app login'),('account-alert','unexpected account takeover alert'),('cloned-session','reported cloned session'),('unrecognized-mandate','unrecognized payment authorization'),('multiple-alerts','unexpected payment alerts')],
'NEEDS_INFORMATION':[
 ('unclear-status','unclear UPI payment status'),('missing-receipt','missing UPI receipt'),('cropped-sms','cropped UPI SMS'),('only-balance','uncertain balance observation'),('vague-debit','unclear debit description'),('history-unavailable','unavailable transaction history'),('missing-screenshot','missing payment screenshot'),('unconfirmed-payment','uncertain payment attempt'),('unknown-reference','unlabelled reference in a note'),('unclear-rail','unclear UPI payment details')],
}
# Ten distinct narrative frames are shared across translations, not split apart.
FRAMES={
'english':[
 'I checked the receipt after leaving the counter. The issue is {topic}.',
 'The service desk asked me to describe what happened with {topic}.',
 'I noticed this while reconciling my payment history for {topic}.',
 'The other person cannot help me resolve the issue concerning {topic}.',
 'I have kept the app screenshot related to {topic}; please check the facts.',
 'I am contacting support after an unsuccessful attempt to resolve {topic}.',
 'My payment record looks inconsistent in the case of {topic}.',
 'I want a factual review of the incident involving {topic}.',
 'I have not received a clear explanation for the issue with {topic}.',
 'Please help me document the problem about {topic} before I contact the bank.'
],
'hindi_devanagari':[
 'काउंटर से निकलकर रसीद देखी। मामला {topic} से जुड़ा है।',
 'सहायता केंद्र ने {topic} के बारे में पूरी बात लिखने को कहा है।',
 'अपने भुगतान का हिसाब देखते समय {topic} वाली परेशानी दिखी।',
 '{topic} के मामले में सामने वाला व्यक्ति मदद नहीं कर पा रहा है।',
 '{topic} का ऐप स्क्रीनशॉट संभालकर रखा है, कृपया तथ्य जाँचें।',
 '{topic} की परेशानी सुलझाने की कोशिश के बाद सहायता माँग रहा हूँ।',
 '{topic} के लिए भुगतान का रिकॉर्ड समझ नहीं आ रहा है।',
 '{topic} वाले मामले की तथ्यों के आधार पर जाँच चाहिए।',
 '{topic} की परेशानी के बारे में साफ जानकारी नहीं मिली है।',
 'बैंक से बात करने से पहले {topic} की समस्या दर्ज करने में मदद करें।'
],
'hinglish':[
 'Counter se nikalne ke baad receipt dekhi; issue {topic} ka hai.',
 'Support desk ne bola {topic} ki poori baat likh do.',
 'Payment history check karte waqt {topic} wala issue dikha.',
 '{topic} mein doosra person issue resolve nahi kar paa raha.',
 '{topic} ka app screenshot save hai, please facts check karein.',
 '{topic} solve karne ki koshish ki, ab support ki madad chahiye.',
 '{topic} ke liye payment record samajh nahi aa raha.',
 '{topic} wale incident ka factual review chahiye.',
 '{topic} ke issue par clear explanation abhi tak nahi mila.',
 'Bank se baat karne se pehle {topic} ka problem document karna hai.'
],
 'tanglish':[
 'Counter vittu vandha piragu receipt paathen; {topic} pathi issue irukku.',
 'Support desk {topic} pathi nadanthathai ezhutha sonnaanga.',
 'Payment history paakumbodhu {topic} issue therinjathu.',
 '{topic} vishayathil opposite person help panna mudiyala.',
 '{topic} app screenshot save pannirukken; facts check pannunga.',
 '{topic} solve panna try pannen; ippo support help venum.',
 '{topic} payment record enakku puriyala.',
 '{topic} incident facts verify panna vendum.',
 '{topic} issue-ku clear explanation innum kidaikkala.',
 'Bank-kitta pesum munnaadi {topic} problem document panna help pannunga.'
],
'marathi_english':[
 'Counter varun aalyavar receipt pahili; {topic} cha prashna aahe.',
 'Support desk ne {topic} baddal sagla lihayla sangitla.',
 'Payment history baghtana {topic} cha prashna disla.',
 '{topic} madhe samorcha vyakti madat karu shakat nahi.',
 '{topic} cha app screenshot japun thevla aahe; facts tapasa.',
 '{topic} sodvaycha prayatna kela; aata support chi madat pahije.',
 '{topic} cha payment record mala samajat nahi.',
 '{topic} ghatnechi tathyanvar tapasni pahije.',
 '{topic} baddal ajun spashta mahiti milali nahi.',
 'Bankeshi bolnyapurvi {topic} cha prashna nondvayla madat kara.'
],
}
BODIES={
'P2M_CONFIRMATION_FAILURE':[
 'My UPI merchant payment was debited, but the shop received no confirmation and the payment is pending.',
 'मेरे UPI merchant payment में पैसे कट गए, लेकिन दुकान को confirmation नहीं मिला और payment pending है।',
 'Mere UPI merchant payment mein paise kat gaye, shop ko confirmation nahi mila, payment pending hai.',
 'UPI merchant payment debit aachu; shop-ku confirmation varala, payment pending irukku.',
 'UPI merchant payment che paise kat zale, shop la confirmation milala nahi ani payment pending aahe.'
],
'P2P_BENEFICIARY_NOT_CREDITED':[
 'My UPI transfer was debited but the beneficiary was not credited and the recipient has not received the money.',
 'मेरे UPI transfer में पैसे कट गए, लेकिन beneficiary not credited है और recipient को रकम नहीं मिली।',
 'Mera UPI transfer debit ho gaya par beneficiary not credited hai; recipient ko paise nahi mile.',
 'UPI transfer debit aachu; beneficiary not credited, recipient-ku panam varala.',
 'Majhe UPI transfer che paise kat zale pan beneficiary not credited; recipient la paise milale nahi.'
],
'COLLECT_REQUEST_SCAM':[
 'A scammer sent a UPI collect request saying it would release money to me, and my account was debited after approval.',
 'Scammer ने पैसे देने के बहाने UPI collect request भेजी, approve करने के बाद मेरे खाते से रकम कट गई।',
 'Scammer ne paise dene ke liye UPI collect request bheji; approve karte hi mere account se paise kat gaye.',
 'Scammer panam anuppuvatha solli UPI collect request anuppinaan; approve pannathum debit aachu.',
 'Scammer ne paise pathavto mhanun UPI collect request pathavli; approve kelyavar majhe paise kat zale.'
],
'REMOTE_ACCESS_SCAM':[
 'The caller made me install AnyDesk.apk and share my screen; unauthorized UPI debits followed.',
 'कॉलर ने AnyDesk.apk install करवाकर screen share कराया; उसके बाद unauthorized UPI debit हुए।',
 'Caller ne AnyDesk.apk install karwa ke screen share karaya; uske baad unauthorized UPI debit hue.',
 'Caller AnyDesk.apk install panna solli screen share panninaan; athukku piragu unauthorized UPI debit aachu.',
 'Caller ne AnyDesk.apk install karayla sangun screen share ghetla; nantar unauthorized UPI debit zale.'
],
'VOLUNTARY_WRONG_VPA_TRANSFER':[
 'I voluntarily sent the UPI payment to the wrong VPA by mistake; I selected the incorrect recipient myself.',
 'मैंने गलती से खुद UPI payment wrong VPA पर भेज दिया और गलत recipient चुन लिया।',
 'Maine galti se khud UPI payment wrong VPA par bhej diya; recipient maine hi galat choose kiya.',
 'Naan thavaruthalaa UPI payment wrong VPA-ku anuppitten; recipient-ai naane wrong-aa select pannen.',
 'Mi chukun swatah UPI payment wrong VPA var pathavla; recipient mich chukicha nivadla.'
],
'UNAUTHORIZED_ACCOUNT_TAKEOVER':[
 'I did not authorize these UPI payments. My account was hacked and money was debited without my permission.',
 'मैंने ये UPI payment authorize नहीं किए। मेरा account hacked हुआ और बिना अनुमति पैसे कट गए।',
 'Maine yeh UPI payment authorize nahi kiye; account hacked hua aur bina permission paise kat gaye.',
 'Indha UPI payments naan authorize pannala; account hacked, en permission illama debit aachu.',
 'He UPI payments mi authorize kele nahi; account hacked zala ani parvangi shivay paise kat zale.'
],
'NEEDS_INFORMATION':[
 'I need help understanding a UPI transaction. I cannot confirm the status, recipient, amount or reference yet.',
 'मुझे UPI transaction समझने में मदद चाहिए। अभी status, recipient, रकम या reference की पुष्टि नहीं कर सकता।',
 'UPI transaction samajhne mein help chahiye; status, recipient, amount aur reference abhi confirm nahi hai.',
 'UPI transaction purinjukka help venum; status, recipient, amount, reference innum confirm pannala.',
 'Mala UPI transaction samjun ghyayla madat pahije; status, recipient, amount ani reference ajun confirm nahi.'
],
}
NEGATIVES={
'english':'Your refund is 100% guaranteed. The dispute is already filed and a full reversal is approved.',
'hindi_devanagari':'आपका रिफंड 100% गारंटी के साथ मंजूर है। refund approved है और dispute already filed है।',
'hinglish':'Aapka refund 100% guaranteed hai. Dispute already filed hai aur full reversal approved hai.',
'tanglish':'Unga refund 100% guaranteed. Dispute already filed, full reversal approved aachu.',
'marathi_english':'Tumcha refund 100% guaranteed aahe. Dispute already filed ani full reversal approved aahe.'}


def negative_reply(language):return NEGATIVES[language]


def generate_synthetic():
    rows=[]
    for ci,(category,families) in enumerate(FAMILIES.items()):
        for fi,(slug,topic) in enumerate(families):
            family=f'synthetic:{category.lower()}:{slug}'
            for li,language in enumerate(LANGUAGES):
                for variant in range(2):
                    amount=(ci+1)*1250+fi*170+li*10+variant if variant else None
                    utr=f'{810000000000+ci*10000+fi*100+li*2+variant:012}' if variant else None
                    urgent=variant==1
                    message=FRAMES[language][fi].format(topic=topic)+' '+BODIES[category][li]
                    if variant:message+=f' SMS: Rs {amount} debited via UPI Ref No {utr}. Please help!!'
                    context={'language':language,'responsibility':'unknown','account_tier':'unknown'}
                    delay=None;future=False;elapsed=None
                    if variant and category in ('COLLECT_REQUEST_SCAM','REMOTE_ACCESS_SCAM','UNAUTHORIZED_ACCOUNT_TAKEOVER'):
                        context['responsibility']=['third_party','bank','customer'][fi%3]
                        delay=[0,3,4,7,8][fi%5];context['reporting_delay_working_days']=delay
                    if variant and category.startswith(('P2P','P2M')):
                        elapsed=[0,1,2,5,6,10,3,7,11,8][fi];context['elapsed_calendar_days']=elapsed
                    if fi==9 and variant:
                        future=True;context['transaction_date']='2027-01-02'
                    target=target_from_facts(category,language,amount=amount,utr=utr,delay=delay,responsibility=context['responsibility'],future=future,urgent=urgent,elapsed=elapsed)
                    rows.append({'sample_id':f'syn-{ci}-{fi}-{li}-{variant}','scenario_group':family,'split':'train','origin':'synthetic',
                        'synthetic_status':'locally_authored_template_reconstruction','human_reviewed':False,'label_status':'synthetic_specification_unreviewed',
                        'annotation_facts':{'category':category,'amount_inr':amount,'utr_number':utr,'urgent':urgent,'policy_context':context},
                        'input':{'message':message,**context},'target':target,'rejected_reply':negative_reply(language),
                        'negative_origin':'synthetic_unsafe_guarantee','usage':'development','generator_version':'upi-families-v1'})
    return rows
