# 🌅 AI -FsD — Group 1

**Repository:** <https://github.com/CAPTAIN/AI-FD-Group-1>

Group 1's shared repository for the Saturday AI full-stack session (17 October 2026).
Every member built an **About me** page with React + Vite, deployed it to Vercel, and added their name and link to the table below.

## Crew

| Name | Role | About me page | Branch
|------|------|---------------|---------|
| Jamiu Muritala | *Captain* | <https://about-me-two-cyan.vercel.app> | [`mury`](../../tree/mury) |
| *Example: Your Name* | *Member* | *<https://your-link.vercel.app>* | [`yourname`]((../../tree/<yourname>)) |
| Azuwuike Victor | *Member* | <https://about-me-six-amber.vercel.app> | [`add-victor`](../../tree/add-victor) |
| Faizat Adebiyi | Member |https://septaaifullstackdevelopmentprojects.vercel.app/|

The example row shows the format. Add your own row at the bottom of the table (see "Add yourself" below). Don't edit the example row.

## How this repo is organised

- **`main`** holds this README only. Nothing else goes here.
- **`yourname`** branches are how each person signs the Crew table. The captain merges these into `main`.
- Your About me project itself stays in your own folder (and on Vercel). It doesn't go in this repo.


## Add yourself to the Crew table

Open the VS Code terminal in any folder **outside** your About me project (for example, your Documents folder) and run:

```bash
git clone https://github.com/CAPTAIN/AI-FD-Group-1.git
cd AI-FD-Group-1
git checkout -b yourname      # your own name, lowercase, e.g. victor
```

Open `README.md` and add one line at the bottom of the **Crew** table, below the example row:

```markdown
| Azuwuike Victor | Member | https://your-link.vercel.app |
```

Then send it up:

```bash
git add README.md
git commit -m "Add yourname"
git push -u origin add-yourname
```

Check: open <https://github.com/CAPTAIN/AI-FD-Group-1/branches> — your `add-yourname` branch should be listed.

The captain merges your branch, and your name and link show up on `main`.

## Quick fixes

| Problem | Fix |
| --------- | ----- |
| `git` is not recognized | Install Git from git-scm.com, then close and reopen VS Code |
| Git asks who you are | `git config --global user.name "Name"` and `git config --global user.email "email"` |
| `git push` asks for a password | Sign in to GitHub from VS Code's Source Control panel |
| `git push` says "permission denied" | Accept the collaborator invite in your email first |
| Don't have a Vercel link yet | From your About me project folder, run `npx vercel --prod` (project name must be lowercase) |


## Stack

- React + Vite
- Vercel (hosting)
- Git + GitHub (collaboration)
