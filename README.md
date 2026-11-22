# Cenaillion

A WWE rarity guessing game. You get 7 random WWE categories and 25 seconds for each. Name the rarest answer you can think of.

| Spot | Points | Rarity |
| --- | --- | --- |
| Entrance Ramp | +10 | popular answer |
| On the Apron | +15 | relatively popular |
| In the Ring | +30 | kind of popular |
| Commentary Desk | +60 | rare |
| Front Row Seat | +85 | very rare |
| In the Stands | +100 | One in a Cenaillion |

There are 200+ categories. Play the **Daily Card** (the same for everyone each day) or an endless **Random Match**.

## Run locally

It's a static site with no build step:

```bash
python3 -m http.server 5173
```

## Adding categories

Categories live in `js/data/*.js`:

```
@Category Name ~ optional hint
1: Popular Answer, Another/Alias
...
6: Rarest Answer
```

Tiers 1–6 map to Ramp → Stands. A category whose highest tier is below 6 is spread across the full range automatically. Global nicknames live in `js/aliases.js`.
