# Bundled font licenses

Everything this app draws handwriting with lives in this folder: the stroke
bundles in `bundles/` (one JSON per face), the manifest that configures them in
`index.ts`, and the original archives in `sources/`.

All faces but Hershey Script are licensed under the
[SIL Open Font License, Version 1.1](https://openfontlicense.org/); Hershey
Script carries the Hershey Fonts' own terms (below). The locally supplied faces
at the end of this file are **not** cleared for redistribution.

## Polan Stronk

- **Designer**: Purnomo Siswoprasetijo (Pahigar Type)
- **Copyright**: Copyright (c) 2015, Purnomo Siswoprasetijo (purnomo@polantron.com)
- **License**: SIL Open Font License, Version 1.1
- **Used as**: the default handwriting face (`bundles/polan-stronk.json`) and the
  one OpenType file the UI itself loads (`sources/PolanStronk.otf`, declared in
  `src/renderer/src/styles/global.css`).

## Caveat

- **Designer**: Impallari Type
- **Copyright**: Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat)
- **License**: SIL Open Font License, Version 1.1

## Italianno

- **Designer**: Robert Leuschke
- **Copyright**: Copyright 2009 The Italianno Project Authors (https://github.com/googlefonts/italianno)
- **License**: SIL Open Font License, Version 1.1

## Tangerine

- **Designer**: Toshi Omagari
- **Copyright**: Copyright (c) 2010 by Toshi Omagari
- **License**: SIL Open Font License, Version 1.1

## Parisienne

- **Designer**: Brian J. Bonislawsky (Astigmatic)
- **Copyright**: Copyright (c) 2012 by Brian J. Bonislawsky DBA Astigmatic (AOETI)
- **License**: SIL Open Font License, Version 1.1

## Suez One

- **Designer**: Michal Sahar
- **Copyright**: Copyright 2016 Michal Sahar. All rights reserved.
- **License**: SIL Open Font License, Version 1.1

## Klee One

- **Designer**: Fontworks Inc.
- **Copyright**: Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee)
- **License**: SIL Open Font License, Version 1.1

## Amiri

- **Designer**: Khaled Hosny
- **Copyright**: Copyright 2010-2022 The Amiri Project Authors (https://github.com/aliftype/amiri)
- **License**: SIL Open Font License, Version 1.1

## Tillana

- **Designer**: Indian Type Foundry, Shiva Nallaperumal
- **Copyright**: Copyright (c) 2014, Indian Type Foundry (info@indiantypefoundry.com)
- **License**: SIL Open Font License, Version 1.1

## Nanum Pen Script

- **Designer**: Sandoll Communications Inc. for NHN Corporation
- **Copyright**: Copyright © 2010 NHN Corporation. All rights reserved. Font designed by Sandoll Communications Inc.
- **License**: SIL Open Font License, Version 1.1

## Atma

- **Designer**: Black Foundry
- **Copyright**: Copyright 2015 The Atma Project Authors (www.black-foundry.com)
- **License**: SIL Open Font License, Version 1.1

## LXGW WenKai

- **Designer**: LXGW, derived from Klee One by Fontworks Inc.
- **Copyright**: Copyright 2021-2026 LXGW (https://github.com/lxgw/LxgwWenKai); Copyright 2020 The Klee Project Authors (https://github.com/fontworks-fonts/Klee)
- **License**: SIL Open Font License, Version 1.1

## EMS Allure

A stroke font: its bundle's glyph data is the font's pen strokes, and the bundled `.otf` is made from those strokes by Tegaki.

- **Designer**: Sheldon B. Michaels (single-line derivative of Allura by Rob Leuschke, TypeSETit); SVG font conversion by Windell H. Oskay (https://gitlab.com/oskay/svg-fonts)
- **Copyright**: Copyright 2010 The Allura Project Authors (https://github.com/googlefonts/allura); single-line version by Sheldon B. Michaels
- **License**: SIL Open Font License, Version 1.1

## Hershey Script 1-stroke

A stroke font, as EMS Allure above. It is not under the Open Font License; the Hershey Fonts may be used by anyone for any purpose, provided these acknowledgements are distributed with the font data:

- The Hershey Fonts were originally created by Dr. A. V. Hershey while working at the U. S. National Bureau of Standards.
- The format of the Font data in this distribution was originally created by James Hurt, Cognition, Inc., 900 Technology Park Drive, Billerica, MA 01821.
- This version was prepared in 2011 and converted to SVG fonts in 2019 by Windell H. Oskay (www.evilmadscientist.com), adapted from emergent.unpythonic.net/software/hershey by way of "Hershey Fonts in SVG" by Marty McGuire.

The font data may be converted into any other format *except* the format distributed by the U.S. NTIS, where each point is described in eight bytes as "xxx yyy:". The full notice ships with the vendored generator at `tools/tegaki/packages/renderer/fonts/hershey-script/LICENSE.txt`.

---

## Locally supplied fonts (NOT cleared for redistribution)

These bundles were generated from the font archives in `fonts/sources/`. **None
of them arrived with a license file.** They are wired into the app so the
handwriting animation can be evaluated, but their legal status is unverified and
they must not ship in a distributed build until each one is cleared:

| Bundle id        | Source file                    | Known provenance                     |
| ---------------- | ------------------------------ | ------------------------------------ |
| `akrobat`        | `Akrobat.ttf`                  | Typeland, free for personal use only |
| `bileha`         | `Bileha.otf`                   | dafont distribution, terms unknown   |
| `blazeberg`      | `Blazeberg.otf`                | dafont distribution, terms unknown   |
| `boone`          | `BOONE.otf`                    | dafont distribution, terms unknown   |
| `burkhan`        | `Burkhan.otf`                  | dafont, terms unknown — never converted, no bundle |
| `danymeka`       | `Danymeka-lxx2D.otf`           | dafont distribution, terms unknown   |
| `gixel`          | `Gixel.ttf`                    | dafont distribution, terms unknown   |
| `golden-avocado` | `GoldenAvocado-8OOlM.otf`      | dafont distribution, terms unknown   |
| `lt-serif`       | `LT.SerifDemo.otf`             | Linotype demo cut, reduced glyph set  |
| `mestika`        | `Mestika.otf`                  | dafont distribution, terms unknown   |
| `rogbold`        | `Rogbold-3llGM.otf`            | dafont distribution, terms unknown   |
| `simple-things`  | `SimpleThings-gwwoE.ttf`       | dafont distribution, terms unknown   |
| `siraman`        | `SiramanRegular-q22nq.otf`     | dafont distribution, terms unknown   |
| `skrine`         | `Skrine.otf`                   | dafont distribution, terms unknown   |
| `waffle-mango`   | `Waffle Mango.ttf`             | dafont distribution, terms unknown   |

Most of these came from free-font download sites, where "personal use only" is
the common grant and commercial redistribution usually needs a paid licence from
the foundry. Treat this table as a to-clear list.

`arial.zip` was deliberately **not** converted: Arial is a Microsoft/Monotype
proprietary face that cannot be bundled, and it is already available as a system
font.

---

## SIL Open Font License, Version 1.1

Permission is hereby granted, free of charge, to any person obtaining a copy of
the Font Software, to use, study, copy, merge, embed, modify, redistribute, and
sell modified and unmodified copies of the Font Software, subject to the
following conditions:

1. Neither the Font Software nor any of its individual components, in Original
   or Modified Versions, may be sold by itself.

2. Original or Modified Versions of the Font Software may be bundled,
   redistributed and/or sold with any software, provided that each copy contains
   the above copyright notice and this license. These can be included either as
   stand-alone text files, human-readable headers or in the appropriate
   machine-readable metadata fields within text or binary files as long as those
   fields can be easily viewed by the user.

3. No Modified Version of the Font Software may use the Reserved Font Name(s)
   unless explicit written permission is granted by the corresponding Copyright
   Holder.

4. The Font Software, modified or unmodified, in part or in whole, must be
   distributed entirely under this license, and must not be distributed under
   any other license.

5. The Font Software may not be used in products or activities that are illegal
   or harmful, or promote illegal or harmful actions.

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF COPYRIGHT, PATENT, TRADEMARK, OR
OTHER RIGHT. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL,
OR CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM OTHER
DEALINGS IN THE FONT SOFTWARE.
