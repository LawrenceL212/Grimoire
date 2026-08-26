from fractions import Fraction as F

def rep(name, comp, arr):
    t = {k: comp[k]-arr[k] for k in comp}
    print(name, "turnaround", t, "avg", F(sum(t.values()),len(t)), float(F(sum(t.values()),len(t))))

# W1 FIFO A=100 B=10 C=10 all at 0
comp={'A':100,'B':110,'C':120}; arr={'A':0,'B':0,'C':0}
rep("W1 FIFO", comp, arr)
resp={'A':0,'B':100,'C':110}; print(" resp avg", F(sum(resp.values()),3), float(F(sum(resp.values()),3)))

# W1 SJF
comp={'B':10,'C':20,'A':120}
rep("W1 SJF", comp, arr)
resp={'B':0,'C':10,'A':20}; print(" resp avg", F(sum(resp.values()),3), float(F(sum(resp.values()),3)))

# W3 SJF nonpreemptive: A(0,100) B(10,10) C(10,10)
arr3={'A':0,'B':10,'C':10}
comp={'A':100,'B':110,'C':120}
rep("W3 SJF-nonpre", comp, arr3)
resp={'A':0,'B':100-10,'C':110-10}; print(" resp avg", F(sum(resp.values()),3), float(F(sum(resp.values()),3)))
# STCF
comp={'B':20,'C':30,'A':120}
rep("W3 STCF", comp, arr3)
resp={'A':0,'B':0,'C':10}; print(" resp avg", F(sum(resp.values()),3), float(F(sum(resp.values()),3)))

# W4 RR q=1, three jobs len 5
def rr(lengths, q):
    jobs=[[n,l,None,None] for n,l in lengths]  # name,remaining,first,comp
    t=0; i=0; queue=list(range(len(jobs)))
    from collections import deque
    dq=deque(queue)
    while dq:
        j=dq.popleft()
        if jobs[j][2] is None: jobs[j][2]=t
        run=min(q,jobs[j][1]); t+=run; jobs[j][1]-=run
        if jobs[j][1]==0: jobs[j][3]=t
        else: dq.append(j)
    return jobs
for q in (1,2,5,10):
    jobs=rr([('A',5),('B',5),('C',5)],q)
    print("RR len5 q=%d"%q, [(j[0],j[2],j[3]) for j in jobs],
          "avg turn", F(sum(j[3] for j in jobs),3), float(F(sum(j[3] for j in jobs),3)),
          "avg resp", F(sum(j[2] for j in jobs),3), float(F(sum(j[2] for j in jobs),3)))
for q in (2,10):
    jobs=rr([('A',10),('B',10),('C',10)],q)
    print("RR len10 q=%d"%q, [(j[0],j[2],j[3]) for j in jobs],
          "avg turn", F(sum(j[3] for j in jobs),3), float(F(sum(j[3] for j in jobs),3)),
          "avg resp", F(sum(j[2] for j in jobs),3), float(F(sum(j[2] for j in jobs),3)))
