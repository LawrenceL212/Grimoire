from collections import deque
ALLOT=10; QUANT=10; NQ=3
def sim(jobs,S=None,end=200,snaps=()):
    st={n:{'arr':a,'rem':l,'q':NQ-1,'used':0,'comp':None,'cpu':0} for n,(a,l) in jobs.items()}
    qs=[deque() for _ in range(NQ)]
    arrived=set(); timeline=[]; snapshot={}
    t=0; cur=None; quantum_left=0
    while t<end:
        for n,s in st.items():
            if s['arr']==t and n not in arrived:
                arrived.add(n); s['q']=NQ-1; s['used']=0; qs[NQ-1].append(n)
                if cur and st[cur]['q']<NQ-1:
                    qs[st[cur]['q']].appendleft(cur); cur=None
        if S and t>0 and t%S==0:
            for q in qs: q.clear()
            if cur: qs[NQ-1].append(cur)
            for n,s in st.items():
                if n in arrived and s['rem']>0 and n!=cur:
                    qs[NQ-1].append(n)
            for n,s in st.items():
                if s['rem']>0: s['q']=NQ-1; s['used']=0
            cur=None
        if t in snaps:
            snapshot[t]={n:(s['q'],s['cpu'],s['rem']) for n,s in st.items()}
        if cur is None:
            for qi in range(NQ-1,-1,-1):
                if qs[qi]:
                    cur=qs[qi].popleft(); quantum_left=QUANT; break
        if cur is None:
            timeline.append((t,'idle')); t+=1; continue
        s=st[cur]
        s['rem']-=1; s['cpu']+=1; s['used']+=1; quantum_left-=1
        timeline.append((t,cur))
        if s['rem']==0:
            s['comp']=t+1; cur=None
        elif s['used']>=ALLOT and s['q']>0:
            s['q']-=1; s['used']=0; qs[s['q']].append(cur); cur=None
        elif quantum_left==0:
            qs[s['q']].append(cur); cur=None
        t+=1
    return st,timeline,snapshot
def runs(tl):
    out=[]
    for t,n in tl:
        if out and out[-1][2]==n: out[-1][1]=t+1
        else: out.append([t,t+1,n])
    return [tuple(x) for x in out]
st,tl,sn=sim({'A':(0,200),'B':(100,20)},None,160,{5,15,25,105,115,121})
print("T1",runs(tl)); print(" Bcomp",st['B']['comp'])
for k in sorted(sn): print("  t",k,sn[k])
st,tl,sn=sim({'A':(0,100),'B':(25,100)},50,60,{5,15,24,30,40,49,50,51,55})
print("T2",runs(tl))
for k in sorted(sn): print("  t",k,sn[k])
