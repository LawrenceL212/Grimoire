from fractions import Fraction as F
from collections import deque
def rr(lengths,q,arrivals=None):
    arr={n:0 for n,_ in lengths} if arrivals is None else arrivals
    rem={n:l for n,l in lengths}; first={}; comp={}
    dq=deque([n for n,_ in lengths]); t=0
    while dq:
        n=dq.popleft()
        if n not in first: first[n]=t
        r=min(q,rem[n]); t+=r; rem[n]-=r
        if rem[n]==0: comp[n]=t
        else: dq.append(n)
    return first,comp,arr
for q in (2,4,8):
    f,c,a=rr([('A',8),('B',4),('C',4)],q)
    tt={n:c[n]-a[n] for n in c}; rt={n:f[n]-a[n] for n in f}
    print("RR A8B4C4 q=%d"%q, "first",f,"comp",c,"avgT",F(sum(tt.values()),3),float(F(sum(tt.values()),3)),"avgR",F(sum(rt.values()),3),float(F(sum(rt.values()),3)))
# FIFO A8 B4 C4 order A,B,C
comp={'A':8,'B':12,'C':16}; print("FIFO A8B4C4 avgT",F(8+12+16,3), "avgR", F(0+8+12,3))
# switch overhead: 3 jobs 12ms each, RR quantum q, 1ms per switch
for q in (2,4,12):
    slices=3*(12//q); sw=slices-1
    print("q=%d slices=%d switches=%d overhead=%d total=%d"%(q,slices,sw,sw,36+sw))
# STCF completion order: A(0,10) B(2,3) C(4,1) D(6,5)
jobs={'A':(0,10),'B':(2,3),'C':(4,1),'D':(6,5)}
rem={n:l for n,(a,l) in jobs.items()}; t=0; comp={}; first={}
while any(rem[n]>0 for n in rem):
    ready=[n for n in rem if jobs[n][0]<=t and rem[n]>0]
    if not ready: t+=1; continue
    n=min(ready,key=lambda n:(rem[n],jobs[n][0],n))
    if n not in first: first[n]=t
    rem[n]-=1; t+=1
    if rem[n]==0: comp[n]=t
print("STCF comp",comp,"order",sorted(comp,key=comp.get))
tt={n:comp[n]-jobs[n][0] for n in comp}
print(" turn",tt,"avg",F(sum(tt.values()),4),float(F(sum(tt.values()),4)))
rtt={n:first[n]-jobs[n][0] for n in first}; print(" resp",rtt,"avg",F(sum(rtt.values()),4),float(F(sum(rtt.values()),4)))
