import ast,sys
p='backend/server.py'
try:
    s=open(p,'r',encoding='utf-8').read()
    ast.parse(s)
    print('OK')
except SyntaxError as e:
    print('SYNTAXERROR', e.lineno, e.offset, repr(e.text))
    sys.exit(1)
except Exception as e:
    print('ERROR', repr(e))
    sys.exit(2)
