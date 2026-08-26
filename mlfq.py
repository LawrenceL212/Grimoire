# MLFQ: 3 queues Q2 high Q1 Q0 low. allotment 10ms at each level. RR quantum 10 within a queue.
# boost period S (None = off)
def sim(jobs, S=None, end=200):
    # jobs: name -> (arrival, length)
    st = {n: {'arr':a,'rem':l,'q':2,'used':0,'first':None,'comp':None} for n,(a,l) in jobs.items()}
    order = []  # timeline entries (t, name)
    t = 0
    log = []
    while t < end:
        if S and t>0 and t % S == 0:
            for s in st.values():
                if s['rem']>0: s['q']=2; s['used']=0
        ready = [n for n,s in st.items() if s['arr']<=t and s['rem']>0]
        if not ready:
            log.append((t,'idle')); t+=1; continue
        maxq = max(st[n]['q'] for n in ready)
        cand = [n for n in ready if st[n]['q']==maxq]
        # round robin among cand: pick the one least recently run
        cand.sort(key=lambda n: (last.get(n,-1)))
        n = cand[0]
        if st[n]['first'] is None: st[n]['first']=t
        log.append((t,n)); st[n]['rem']-=1; st[n]['used']+=1
        last[n]=t
        if st[n]['rem']==0: st[n]['comp']=t+1
        if st[n]['used']>=10 and st[n]['q']>0:
            st[n]['q']-=1; st[n]['used']=0
        t+=1
    return st, log

def runs(log):
    out=[]; 
    for t,n in log:
        if out and out[-1][2]==n: out[-1][1]=t+1
        else: out.append([t,t+1,n])
    return [(a,b,n) for a,b,n in out]

last={}
st,log = sim({'A':(0,200),'B':(100,20)}, S=None, end=140)
print("TRACE1", runs(log))
print(" B comp", st['B']['comp'], "A cpu by 120", sum(1 for t,n in log if n=='A' and t<120))
for tq in (5,15,25,105,115,150):
    pass
# queue of A at various times: recompute by simulating stepwise snapshot
def snapshot(jobs,S,times,end=200):
    global last
    last={}
    st = {n: {'arr':a,'rem':l,'q':2,'used':0,'first':None,'comp':None} for n,(a,l) in jobs.items()}
    snaps={}
    t=0
    while t<end:
        if S and t>0 and t%S==0:
            for s in st.values():
                if s['rem']>0: s['q']=2; s['used']=0
        if t in times:
            snaps[t]={n:(s['q'],s['rem']) for n,s in st.items()}
        ready=[n for n,s in st.items() if s['arr']<=t and s['rem']>0]
        if ready:
            maxq=max(st[n]['q'] for n in ready)
            cand=sorted([n for n in ready if st[n]['q']==maxq], key=lambda n: last.get(n,-1))
            n=cand[0]
            if st[n]['first'] is None: st[n]['first']=t
            st[n]['rem']-=1; st[n]['used']+=1; last[n]=t
            if st[n]['rem']==0: st[n]['comp']=t+1
            if st[n]['used']>=10 and st[n]['q']>0: st[n]['q']-=1; st[n]['used']=0
        t+=1
    return snaps,st

snaps,st = snapshot({'A':(0,200),'B':(100,20)}, None, {5,15,25,105,115,121,150}, 200)
for k in sorted(snaps): print("t=",k,snaps[k])

last={}
st2,log2 = sim({'A':(0,100),'B':(25,100)}, S=50, end=60)
print("TRACE2", runs(log2))
print(" A cpu by 50", sum(1 for t,n in log2 if n=='A' and t<50), " B cpu by 50", sum(1 for t,n in log2 if n=='B' and t<50))
snaps2,_ = snapshot({'A':(0,100),'B':(25,100)}, 50, {5,15,22,30,40,49,50,51}, 60)
for k in sorted(snaps2): print("t=",k,snaps2[k])
