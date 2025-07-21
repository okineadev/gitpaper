<img src="assets/newspaper.svg" width="70" align="left">

# **`gitpaper`** \[WIP\]

> The first ever generator of non-boring and actually detailed release notes

## 🛠️ Usage

```bash
npx gitpaper
```

`gitpaper` will automatically generate release notes starting from the last release to the last commit by default.

Here is an example of the generated Markdown:

###    🚀 Enhancements

- Add support for terminal hyperlinks  -  by Dev Khalid [<samp>(7e21c)</samp>](https://github.com///commit/7e21c3f4a1b2c5d6e7f8090a12b34c56d78e90f1)

> Now terminal links are clickable in supported environments, making logs and CLI output more interactive (and less copy-pasty).

###    🐛 Fixes

- Resolve crash when reading empty config files  -  by Mei-Ling Zhou [<samp>(c1d45)</samp>](https://github.com///commit/c1d45ef7a9bc4321def56789abcde0123456789f)

> Prevented an edge case crash when config files exist but contain... absolutely nothing. Now it fails gracefully and logs a warning.

---

The main feature is extended descriptions of changes in release notes, which makes it much clearer for your users

To have these descriptions appear in your release notes, you need to insert a special `::: changelog` section in the extended commit description:

```plaintext
Multiline strings were inconsistently parsed when using backticks inside templates.

Tested on macOS, Ubuntu, and Windows 11 (PowerShell and Git Bash).

::: changelog
Enhanced the parser to correctly capture multiline strings, especially those using backticks.
No more chopped-off input on line breaks in the final output.
:::

Fixes #123

Co-authored-by: Chloe Nakamura <chloe@devmail.com>
Co-authored-by: Viktor Petrov <v.petrov@codebase.org>
```

So you decide what exactly should be written in the release notes.

## ❤️ Support

If you like this project, consider supporting it by starring ⭐ it on GitHub, sharing it with your friends, or [buying me a coffee ☕](https://github.com/okineadev/vitepress-plugin-llms?sponsor=1)

<!-- ## 🤝 Contributing

You can read the instructions for contributing here - [CONTRIBUTING.md](./CONTRIBUTING.md) -->

## 📜 License

<!-- spell-checker:disable-next-line -->

[MIT License](./LICENSE) © 2025-present [Yurii Bogdan](https://github.com/okineadev)

## 👨‍🏭 Contributors

Thank you to everyone who helped with the project!

![Contributors](https://contributors-table.vercel.app/image?repo=okineadev/gitpaper&width=50&columns=15)
