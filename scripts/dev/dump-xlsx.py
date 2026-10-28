"""Structural map of an .xlsx using only the standard library — an xlsx is a zip of XML,
and the container's pip targets a different interpreter than its python3.

Prints, per sheet: every non-empty cell, its formula when it has one, and its cached
value. The workbook path is an argument; nothing is imported from its directory."""
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

path = sys.argv[1]
z = zipfile.ZipFile(path)

shared = []
if 'xl/sharedStrings.xml' in z.namelist():
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in root.findall('m:si', NS):
        shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))

rels = {}
if 'xl/_rels/workbook.xml.rels' in z.namelist():
    for rel in ET.fromstring(z.read('xl/_rels/workbook.xml.rels')):
        rels[rel.get('Id')] = rel.get('Target')

wb = ET.fromstring(z.read('xl/workbook.xml'))
sheets = []
for sh in wb.find('m:sheets', NS):
    target = rels.get(sh.get('{%s}id' % NS['r']), '')
    if target and not target.startswith('/'):
        target = 'xl/' + target.lstrip('/')
    sheets.append((sh.get('name'), target.lstrip('/')))

defined = wb.find('m:definedNames', NS)
if defined is not None:
    print('DEFINED NAMES:')
    for dn in defined:
        print('   ', dn.get('name'), '=', (dn.text or '').strip())

print('SHEETS:', [s[0] for s in sheets])

for name, part in sheets:
    if part not in z.namelist():
        print(f'\n!! sheet {name!r}: part {part} missing')
        continue
    print(f"\n{'=' * 78}\nSHEET {name!r}   ({part})")
    root = ET.fromstring(z.read(part))
    for row in root.iter('{%s}row' % NS['m']):
        for c in row.findall('m:c', NS):
            ref, t = c.get('r'), c.get('t')
            f = c.find('m:f', NS)
            v = c.find('m:v', NS)
            isv = c.find('m:is', NS)
            if t == 's' and v is not None:
                val = shared[int(v.text)]
            elif isv is not None:
                val = ''.join(x.text or '' for x in isv.iter('{%s}t' % NS['m']))
            else:
                val = v.text if v is not None else None
            if f is None and val is None:
                continue
            if f is not None:
                print(f'  {ref:>7}  ={f.text}   -> {val!r}')
            else:
                print(f'  {ref:>7}   {val!r}')
