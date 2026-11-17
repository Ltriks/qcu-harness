"""Static admission for one-component, explicitly declared multi-skill packages.

No code execution and no change to catalog signatures or install authorization.
"""
import json
import re


def validate_skill_bundle(api, meta, files):
    api.need(meta['components'] == [meta['id']] and meta['license'] in ('MIT', 'Apache-2.0'), 'entry.unsupported_shape_use_single_component', 409)
    names = meta['skills']
    if meta['id'] == 'qcu-course-workbench' and meta['productType'] == 'plugin' and names == ['qcu-course-draft']:
        return  # Preserve the existing, separately validated workbench exception.
    api.need(type(names) is list and len(names) <= 20 and len(names) == len(set(names))
             and all(type(name) is str and re.fullmatch(r'qcu-[a-z0-9-]{1,59}', name) for name in names), 'entry.skill_names')
    api.need(not names or meta['id'] in names, 'entry.skill_entrypoint')
    api.need(meta['productType'] != 'skill' or bool(names), 'entry.skill_mismatch')
    raw = files.get('package/skill-bundle.json')
    if len(names) <= 1 and raw is None:
        return  # Existing one-skill and tools-only packages keep their contract.
    api.need(raw is not None and len(raw) <= 65536 and meta['productType'] == 'skill', 'entry.skill_bundle_manifest')
    try:
        manifest = json.loads(raw)
    except (ValueError, UnicodeError):
        api.need(False, 'entry.skill_bundle_json')
    api.need(type(manifest) is dict and set(manifest) == {'schemaVersion', 'id', 'version', 'title', 'description', 'skills'}, 'entry.skill_bundle_fields')
    api.need(manifest['schemaVersion'] == 1 and manifest['id'] == meta['id'] and manifest['version'] == meta['version'], 'entry.skill_bundle_identity')
    members = manifest['skills']
    api.need(type(members) is list and len(members) == len(names), 'entry.skill_bundle_coverage')
    seen = set()
    for member in members:
        api.need(type(member) is dict and set(member) == {'id', 'title', 'description', 'file', 'sha256', 'entrypoint'}, 'entry.skill_bundle_member_fields')
        name = member['id']
        api.need(type(name) is str and name in names and name not in seen, 'entry.skill_bundle_member_name')
        seen.add(name)
        for key in ['title', 'description']:
            api.need(type(member[key]) is str and 0 < len(member[key]) <= 1000 and not re.search(r'[\x00-\x1f\x7f]', member[key]), 'entry.skill_bundle_text')
        expected = 'SKILL.md' if name == meta['id'] else 'skills/' + name + '/SKILL.md'
        api.need(member['file'] == expected and type(member['entrypoint']) is bool and member['entrypoint'] == (name == meta['id']), 'entry.skill_bundle_path')
        content = files.get('package/' + expected)
        api.need(content is not None and member['sha256'] == api.sha(content), 'entry.skill_bundle_digest')
        try:
            parts = content.decode('utf-8').split('---', 2)
        except UnicodeError:
            api.need(False, 'entry.skill_bundle_utf8')
        api.need(len(parts) == 3 and not parts[0].strip() and re.search(r'(?m)^name: *' + re.escape(name) + r' *$', parts[1]), 'entry.skill_bundle_frontmatter')
    api.need(seen == set(names), 'entry.skill_bundle_coverage')
