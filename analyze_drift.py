import json
path = r'C:\Users\Danish\Downloads\full_diagnostic_bundle_1783111472736.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

teacher = json.loads(data.get('teacher_telemetry', '[]'))
student = json.loads(data.get('student_telemetry', '[]'))

def analyze(events, name):
    comps = [e['ComponentState'] for e in events if 'ComponentState' in e and e['ComponentState']['id'] == 'led_1' and e['ComponentState']['key'] == 'brightness']
    print(name, 'led_1 brightness events:', len(comps))
    for e in comps:
        if e.get('time_ms') > 0:
            print('  time:', e.get('time_ms'), 'ms ->', e.get('value'))

analyze(teacher, 'Teacher')
print('---')
analyze(student, 'Student')
