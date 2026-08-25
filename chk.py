import sympy as sp
x,h,t,a = sp.symbols('x h t a', real=True)

def dq(f, aval):
    return sp.simplify((f.subs(x,aval+h)-f.subs(x,aval))/h)

print("S1 x^2 at 3:", sp.simplify(dq(x**2,3)), sp.limit(dq(x**2,3),h,0))
hgt = 20*t-5*t**2
print("height 20t-5t^2: avg [1,1+h]:", sp.simplify((hgt.subs(t,1+h)-hgt.subs(t,1))/h),
      " inst t=1:", sp.diff(hgt,t).subs(t,1))
print("h(1),h(3):", hgt.subs(t,1), hgt.subs(t,3), " avg vel [1,3]:", (hgt.subs(t,3)-hgt.subs(t,1))/2)
print("max height t:", sp.solve(sp.diff(hgt,t),t), hgt.subs(t,2))

print("1/x general:", sp.simplify(sp.limit(dq(1/x,a),h,0)), " at 2:", sp.limit(dq(1/x,2),h,0), " at 3:", sp.limit(dq(1/x,3),h,0))
print("sqrt x at 4:", sp.limit(dq(sp.sqrt(x),4),h,0), " at 9:", sp.limit(dq(sp.sqrt(x),9),h,0))
print("x^3 general:", sp.simplify(sp.limit(dq(x**3,a),h,0)))

# tangent/linear approx sqrt at 4
print("sqrt(4.2)=", sp.N(sp.sqrt(sp.Rational(42,10)),12), " L(4.2)=", sp.N(2+sp.Rational(2,10)/4,12),
      " err=", sp.N(2+sp.Rational(2,10)/4-sp.sqrt(sp.Rational(42,10)),6))
print("sqrt(9.3)=", sp.N(sp.sqrt(sp.Rational(93,10)),12), " L(9.3)=", sp.N(3+sp.Rational(3,10)/6,12))

# |x| at 0
print("|h|/h  right:", sp.limit(sp.Abs(h)/h,h,0,'+'), " left:", sp.limit(sp.Abs(h)/h,h,0,'-'))
# cusp x^(2/3)
q = sp.Abs(h)**sp.Rational(2,3)/h
print("cusp right:", sp.limit(q,h,0,'+'), " left:", sp.limit(q,h,0,'-'))

# 3x^2-2x+1 at 2
f=3*x**2-2*x+1
print("3x^2-2x+1: dq at 2 =", sp.simplify(dq(f,2)), " f'(2)=", sp.diff(f,x).subs(x,2))
# x^2 tangent at 3, approx 3.02^2
print("3.02^2 =", sp.N(sp.Rational(302,100)**2,10), " tangent val:", sp.N(6*sp.Rational(302,100)-9,10))
# x^3-x
g=x**3-x
print("x^3-x deriv:", sp.simplify(sp.limit(dq(g,a),h,0)), " horiz tangents:", sp.solve(sp.diff(g,x),x))
# 2/(x+1) at 1
k=2/(x+1)
print("2/(x+1) dq at 1:", sp.simplify(dq(k,1)), " f'(1)=", sp.diff(k,x).subs(x,1), " general:", sp.diff(k,x))
# 1/x tangent at 2
print("1/x at 2 slope:", sp.diff(1/x,x).subs(x,2), " tangent:", sp.Rational(1,2)+sp.Rational(-1,4)*(x-2), sp.simplify(sp.Rational(1,2)-sp.Rational(1,4)*(x-2)))
print("1/2.1 =", sp.N(sp.Rational(10,21),10), " L(2.1)=", sp.N(1-sp.Rational(21,10)/4,10))
# difference quotients x^2 at 1
for hv in [1, sp.Rational(1,2), sp.Rational(1,10)]:
    print("x^2 a=1 h=",hv, "->", sp.simplify(((1+hv)**2-1)/hv))
print("x^2 at 1 deriv:", sp.limit(dq(x**2,1),h,0))
# |x-3| at 3
print("|x-3| at 3 dq:", sp.limit(sp.Abs(h)/h,h,0,'+'), sp.limit(sp.Abs(h)/h,h,0,'-'))
# x^2 at 5
print("x^2 a=5 dq:", sp.simplify(dq(x**2,5)), sp.limit(dq(x**2,5),h,0))
