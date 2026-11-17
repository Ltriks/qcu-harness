// Isolated official SDK contract test. No model calls or live profile writes.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');

async function main() {
  const kit = path.resolve(process.argv[2] || '.work/qcu-desktop-iteration-20261110/rc44/dist/QCU助手.app/Contents/Resources');
  const api = await require(path.join(kit, 'support/offline.cjs')).runtime(path.join(kit, 'program/DeepSeek Harness.app/Contents/Resources'));
  const teams = [['qcu-deep-research', 7], ['qcu-document-team', 4], ['qcu-data-copilot', 6], ['qcu-ket-prep', 6], ['qcu-ncre-prep', 5]];
  const home = fs.mkdtempSync('/private/tmp/qcu-expert-sdk-');
  const profileDir = path.join(home, 'profiles/desktop');
  fs.mkdirSync(path.dirname(profileDir), {recursive: true});
  fs.cpSync(path.join(kit, 'seed/profiles/desktop'), profileDir, {recursive: true});
  const packageFile = path.join(profileDir, 'package.json');
  const packageConfig = JSON.parse(fs.readFileSync(packageFile));
  for (const [name] of teams) {
    fs.cpSync(path.resolve('packages', name), path.join(profileDir, 'node_modules', name), {recursive: true});
    packageConfig.dependencies[name] = 'file:' + path.resolve('packages', name);
  }
  fs.writeFileSync(packageFile, JSON.stringify(packageConfig));
  const profile = api.boot.loadProfileDirectory('dsh', profileDir, api.anchor);
  const resolution = await api.boot.createRuntimeResolution({installAnchor: api.anchor, profile, home});
  const {Context} = api.req('@deepseek-ai/cordis');
  const {SkillRegistry, renderSkillContent} = await api.load('@deepseek-ai/dsh-skill');
  const {Loader} = await api.load('@deepseek-ai/cordis-plugin-loader');
  const yaml = api.req('js-yaml');
  const results = [];
  for (const [name, expected] of teams) {
    const dir = path.join(profileDir, 'node_modules', name);
    const ctx = new Context();
    try {
      new api.boot.PluginPackages(ctx, {resolution});
      new SkillRegistry(ctx);
      const loader = new Loader(ctx, {baseUrl: pathToFileURL(path.join(profileDir, 'cordis.yml')).href});
      loader.write = () => {};
      const mod = await loader.import(name);
      // Explicit enable gate must reject accidental activation.
      await assert.rejects(() => mod.apply(ctx, {enabled: false}), /Explicit activation/);
      const fork = ctx.plugin(mod, {enabled: true});
      await fork.await();
      const skill = await ctx.skills.get(name);
      assert.ok(skill);
      assert.equal(skill.resourceBase.kind, 'directory');
      assert.equal(fs.realpathSync(skill.resourceBase.path), fs.realpathSync(dir));
      const rendered = renderSkillContent(skill);
      assert.ok(rendered.includes('<skill_instructions>'));
      assert.ok(rendered.includes(dir));
      const frontmatter = yaml.load(skill.content.split('---')[1]);
      assert.equal(frontmatter.name, name);
      assert.ok(frontmatter.description);
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json')));
      assert.equal(manifest.roles.length, expected);
      assert.equal(new Set(manifest.roles.map(r => r.id)).size, expected);
      assert.deepEqual(new Set(manifest.roles.map(r => r.id)), new Set([manifest.lead, ...manifest.members]));
      const source = JSON.parse(fs.readFileSync(path.join(dir, 'SOURCE.json')));
      for (const pin of source.upstreamFiles) {
        const bytes = fs.readFileSync(path.join(skill.resourceBase.path, pin.localPath));
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), pin.sha256);
        assert.equal(bytes.length, pin.bytes);
      }
      const patch = yaml.load(fs.readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8'));
      assert.equal(patch[0].insert[0].disabled, true);
      // Disposal must remove this contribution, not persist a stale provider.
      await fork.dispose();
      assert.equal(await ctx.skills.get(name), undefined);
      results.push({name, roles: expected, discovery: true, resourceAccess: true, provenanceHashes: true, activationGate: true, disposal: true});
    } finally {
      await ctx.fiber.dispose();
    }
  }
  const result = {checks: results, modelsCalled: 0, liveProfileModified: false, scope: 'official-sdk-registration-not-end-to-end'};
  const out = path.resolve('.work/workbuddy-expert-migration/sdk-check.json');
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
main().catch(e => {console.error(e); process.exitCode = 1;});
