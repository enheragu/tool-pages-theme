# tool-pages-theme

Shared Jekyll remote theme for reusable tool page fragments.

This repository centralizes common includes/layouts used by some derived web tools I use to avoid code duplication and easy maintenance and testing.


## Includes


## Layouts

- `tool_document.html`
- `tool_redirect.html`

## Consumption

In a consumer repository `_config.yml`:

```yaml
plugins:
  - jekyll-remote-theme
remote_theme: enheragu/tool-pages-theme
```

Then in pages (with front matter enabled):

```liquid
{% include tools_head_meta.html ... %}
```
