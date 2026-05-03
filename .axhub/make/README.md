# .axhub/make

这个目录用于存放 Axhub Make 项目的本地运行数据、项目配置索引，以及技能清单。

## 目录职责

- `axhub.config.json`
  - 项目运行配置。
- `make.json`
  - 项目级元信息。
- `entries.json`
  - 入口扫描结果，通常由程序生成或刷新。
- `sidebar-tree.json`
  - 侧边栏树数据，通常由程序生成或刷新。
- `.dev-server-info.json`
  - 当前开发服务的本地运行信息。
- `skills/`
  - 技能清单目录，包含官方默认清单和当前项目自定义清单。
- `backups/`
  - 建议的维护备份目录，技能相关备份统一放到 `backups/skills/<timestamp>/`。

## skills 目录规则

技能清单统一放在：

`apps/axhub-make/.axhub/make/skills/`

当前采用两层规则：

- 官方默认清单：`*.default.json`
- 用户自定义清单：同名但不带 `.default`

涉及 4 份 manifest：

- `skills-manifest.default.json`
- `doc-skills-manifest.default.json`
- `theme-skills-manifest.default.json`
- `install-skills-manifest.default.json`

对应的自定义文件分别为：

- `skills-manifest.json`
- `doc-skills-manifest.json`
- `theme-skills-manifest.json`
- `install-skills-manifest.json`

程序读取顺序固定为：

1. 先读自定义清单
2. 若自定义不存在，再回退到 `*.default.json`

注意事项：

- 不做 merge，不做覆盖合并，不做深合并。
- 自定义清单一旦存在，就完整替代对应的默认清单。
- 官方仓库只维护 `*.default.json`。
- 用户自定义清单不发布、不随项目更新覆盖。

## 技能正文位置

技能正文不在这里，官方技能目录位于：

`apps/axhub-make/skills/<skill-id>/`

常见文件包括：

- `apps/axhub-make/skills/<skill-id>/SKILL.md`
- `apps/axhub-make/skills/<skill-id>/references/...`

如果需要恢复某个官方默认技能：

1. 先到 `skills/*.default.json` 找回条目
2. 再到 `apps/axhub-make/skills/<skill-id>/` 找回技能正文
3. 最后按需要补回到当前项目自定义清单中

## 维护建议

- 修改任何技能清单或技能文档前，先备份。
- 推荐备份目录：`.axhub/make/backups/skills/<timestamp>/`
- 默认备份对象：
  - 当前要修改的 manifest 文件
  - 当前要修改的 skill 目录

## 不建议直接手改的文件

以下文件通常属于运行时或扫描产物，除非明确知道影响，否则不要手动编辑：

- `entries.json`
- `sidebar-tree.json`
- `.dev-server-info.json`

## 前端读取入口

前端技能清单的读取入口在：

`apps/prototype-admin/src/index/config/skillManifests.ts`

如果后续再调整 manifest 路径，必须同步修改这里的 glob 路径。
