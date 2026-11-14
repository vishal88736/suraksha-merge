"""Source-grounded silver annotations and scenario-family split controls.

These programmatic labels are not independent expert gold. The runtime engine
is a consistency checker, never the author of these target payloads.
"""
from __future__ import annotations
from collections import Counter,defaultdict
from decimal import Decimal,InvalidOperation
import hashlib
import json
import re
import unicodedata
from research.common import schema_valid,FRAUD

UPI=re.compile(r'\b(?:upi|vpa)\b|यूपीआई|यूपीआइ',re.I)
LOSS=re.compile(r'fail|pending|stuck|debited|kat\s*g|कट|fraud|scam|hacked|wrong\s*(?:upi|vpa)|not\s*(?:receiv|credit)|mila\s*nahi|नहीं\s*(?:मिल|पहुंच)',re.I)
EXCLUDE=re.compile(r'cashback|recharge|reward|lottery|discount|\boffers?\b|extra\s*charg|charges?\s*(?:lag|kat)|\bfees?\b|शुल्क|चार्ज',re.I)


def fingerprint(text):
    text=unicodedata.normalize('NFKC',text).casefold()
    text=re.sub(r'https?://\S+|\S+@\S+',' identifier ',text)
    text=re.sub(r'\[[A-Z_a-z]+\]',' identifier ',text)
    text=re.sub(r'\d+(?:[,.]\d+)*',' number ',text)
    text=' '.join(re.findall(r'\w+',text,flags=re.UNICODE))
    return hashlib.sha256(text.encode()).hexdigest()


def language_of(text):
    if re.search(r'[\u0900-\u097f]',text):return 'hindi_devanagari'
    if re.search(r'\b(?:mera|mere|nahi|gaya|gaye|paise|kya|kaise|karu|hai|yaar|mujhe|hogaya|ho\s*gya)\b',text,re.I):return 'hinglish'
    return 'english'


def independent_category(text):
    """Conservative source-evidence mapper, not a copy of an engine prediction."""
    if re.search(r'anydesk|screen.shar|remote.access|\.apk\b',text,re.I):return 'REMOTE_ACCESS_SCAM'
    if re.search(r'collect\s*request|(?:receive|refund|buyer|seller).{0,70}\bqr\b',text,re.I):return 'COLLECT_REQUEST_SCAM'
    if re.search(r'fraud|scam|hacked|unauthori[sz]ed|without\s*(?:my\s*)?permission|अनधिकृत|धोखाधड़ी',text,re.I):return 'UNAUTHORIZED_ACCOUNT_TAKEOVER'
    if re.search(r'wrong\s*(?:upi|vpa|account)|galat\s*(?:upi|vpa|account)',text,re.I):return 'VOLUNTARY_WRONG_VPA_TRANSFER'
    debit=re.search(r'debit|deduct|kat\s*g|कट',text,re.I)
    missing=re.search(r'not\s*(?:received|credited)|nahi\s*mila|mila\s*nahi|confirmation|pending|failed',text,re.I)
    if debit and missing and re.search(r'merchant|shop|store|p2m|swiggy|zomato',text,re.I):return 'P2M_CONFIRMATION_FAILURE'
    if debit and missing and re.search(r'recipient|beneficiary|friend|transfer|p2p',text,re.I):return 'P2P_BENEFICIARY_NOT_CREDITED'
    return 'NEEDS_INFORMATION'


def target_from_facts(category,language,*,amount=None,utr=None,delay=None,responsibility='unknown',future=False,urgent=False,elapsed=None):
    actions=['CONTACT_BANK_PSP'];tier='PENDING_VERIFICATION'
    if category in ('P2M_CONFIRMATION_FAILURE','P2P_BENEFICIARY_NOT_CREDITED'):
        tier='TECHNICAL_T_PLUS_5' if category.startswith('P2M') else 'TECHNICAL_T_PLUS_1'
        actions+=['RAISE_APP_DISPUTE','TRACK_REVERSAL']
        if elapsed is not None and elapsed>(5 if category.startswith('P2M') else 1):actions+=['REVIEW_COMPENSATION']
    elif category in FRAUD:
        actions+=['SECURE_PAYMENT_CHANNEL','CALL_1930','REPORT_CYBERCRIME','RAISE_APP_DISPUTE','HUMAN_REVIEW']
        if responsibility=='bank':tier='ZERO_LIABILITY_ELIGIBLE'
        elif responsibility=='customer':tier='CUSTOMER_NEGLIGENCE_REVIEW'
        elif responsibility=='third_party' and delay is not None:
            tier='ZERO_LIABILITY_ELIGIBLE' if delay<=3 else 'LIMITED_LIABILITY_ELIGIBLE' if delay<=7 else 'BANK_POLICY_REVIEW'
    elif category=='VOLUNTARY_WRONG_VPA_TRANSFER':
        tier='BANK_POLICY_REVIEW';actions+=['HUMAN_REVIEW']
    else:actions+=['REQUEST_TRANSACTION_DETAILS','HUMAN_REVIEW']
    if future:tier='PENDING_VERIFICATION'
    if not utr:actions+=['REQUEST_UTR']
    result={'utr_number':utr,'dispute_category':category,'amount_inr':amount,'reporting_delay_working_days':delay,
        'rbi_liability_tier':tier,'mandatory_actions':actions,'detected_language':language,
        'panic_severity':'HIGH_CRITICAL' if urgent else 'MEDIUM' if category in FRAUD else 'LOW'}
    if not schema_valid(result):raise ValueError('Invalid independently specified target')
    return result


def public_target(message,language):
    # Unknown account responsibility/dates remain unknown, even when the source
    # assistant claims that a bank has already approved the case.
    refs=set(re.findall(r'\b(?:UTR|RRN|UPI\s*Ref(?:\s*No)?|UPI[/-](?:(?:DR|CR|P2[AMP])[/-])?)\s*[:#=-]?\s*(\d{12})\b',message,re.I))
    amounts=set()
    # Mirrors lib/numbers.ts: "₹500", "Rs.500", "INR 500" and "500 rupaye", "200/-" or a currency word in an Indian script.
    suffix=r'(?:rupaye|rupaiye|rupay|rupees?|rupiya|rupiye|rs\.?(?![^\W\d_])|/-|रुपये|रुपए|रुपया|রুপি|টাকা|ரூபாய்|రూపాయ|ರೂಪಾಯಿ|രൂപ|રૂપિયા|ਰੁਪਏ|روپے|روپیہ|ଟଙ୍କା)(?![^\W\d_])'
    tokens=re.findall(r'(?<!\w)(?:Rs\.?|INR|₹)\s*([0-9][0-9,]*(?:\.\d{1,2})?)(?!\d)(?!\.\d)',message,re.I)
    tokens+=re.findall(r'(?<![\w.,])([0-9][0-9,]*(?:\.\d{1,2})?)\s*'+suffix,message,re.I)
    for token in tokens:
        try:
            number=Decimal(token.replace(',',''))
            if number>0:amounts.add(float(number))
        except InvalidOperation:pass
    urgent=bool(re.search(r'!!|please\s*help|jaldi|panic|bachao|madad|urgent|90,000|90000|help me',message,re.I))
    # Transaction age or an SLA is not reporting delay from bank communication.
    delay_hints=set(int(n) for n in re.findall(
        r'\breported\s+(?:it\s+)?(\d+)\s*working\s*days?\s+after\s+(?:receiving\s+)?(?:the\s+)?(?:bank\s+)?(?:alert|notification|communication)\b',message,re.I))
    delay=next(iter(delay_hints)) if len(delay_hints)==1 and next(iter(delay_hints))<=3650 else None
    return target_from_facts(independent_category(message),language,delay=delay,amount=next(iter(amounts)) if len(amounts)==1 else None,
        utr=next(iter(refs)) if len(refs)==1 else None,urgent=urgent)


def assign_grouped_splits(rows,seed=42):
    groups=defaultdict(list)
    for row in rows:groups[row['scenario_group']].append(row)
    strata=defaultdict(list)
    for family,members in groups.items():
        cats=Counter(r['target']['dispute_category'] for r in members)
        strata[cats.most_common(1)[0][0]].append((family,members))
    assignment={}
    for category,families in sorted(strata.items()):
        total=sum(len(v) for _,v in families);goals={'train':.8*total,'validation':.1*total,'test':.1*total};counts=dict.fromkeys(goals,0)
        ordered=sorted(families,key=lambda v:(-len(v[1]),hashlib.sha256(f'{seed}:{v[0]}'.encode()).hexdigest()))
        for index,(family,members) in enumerate(ordered):
            missing=[s for s in goals if counts[s]==0]
            remaining=len(ordered)-index
            eligible=missing if len(ordered)>=3 and remaining<=len(missing) else list(goals)
            split=max(eligible,key=lambda s:(goals[s]-counts[s],s=='train',s=='validation'))
            assignment[family]=split;counts[split]+=len(members)
    return assignment


def assert_split_isolation(rows):
    families={};hashes={}
    for row in rows:
        split=row['split'];family=row['scenario_group'];fp=fingerprint(row['input']['message'])
        if family in families and families[family]!=split:raise ValueError('Scenario-family leakage')
        if fp in hashes and hashes[fp]!=split:raise ValueError('Normalized text leakage')
        families[family]=split;hashes[fp]=split
    return {'family_overlap':0,'normalized_text_overlap':0,'families':len(families)}


def coalesce_families(rows,threshold=0.85):
    """Keep exact/near duplicates and counterfactuals in one split, across sources."""
    parents={r['scenario_group']:r['scenario_group'] for r in rows}
    def find(key):
        while parents[key]!=key:
            parents[key]=parents[parents[key]];key=parents[key]
        return key
    def union(a,b):
        a,b=find(a),find(b)
        if a!=b:parents[max(a,b)]=min(a,b)
    normalized=[];seen={}
    for row in rows:
        text=unicodedata.normalize('NFKC',row['input']['message']).casefold()
        text=re.sub(r'\d+',' number ',text)
        text=' '.join(text.split())
        key=fingerprint(text)
        if key in seen:union(row['scenario_group'],seen[key])
        else:seen[key]=row['scenario_group']
        normalized.append((row,set(text[i:i+3] for i in range(max(0,len(text)-2)))))
    for i,(a,left) in enumerate(normalized):
        if not left:continue
        for b,right in normalized[:i]:
            if find(a['scenario_group'])==find(b['scenario_group']) or not right:continue
            if min(len(left),len(right))/max(len(left),len(right))<threshold:continue
            if len(left & right)/len(left | right)>=threshold:union(a['scenario_group'],b['scenario_group'])
    for row in rows:row['scenario_group']=find(row['scenario_group'])


def assert_public_numeric_grounding(rows):
    checked=0
    for row in rows:
        if row['origin']!='public_source':continue
        expected=public_target(row['input']['message'],row['target']['detected_language'])
        for field in ('utr_number','amount_inr','reporting_delay_working_days'):
            if row['target'][field]!=expected[field]:raise ValueError('Public numeric evidence is unsupported after normalization')
        checked+=1
    return {'public_rows_checked':checked,'unsupported_public_numeric_fields':0}
