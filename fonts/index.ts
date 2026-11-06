import type { StrokeFontBundle } from '@core/text/strokeFont'

/**
 * Every handwriting font the app ships, in one list.
 *
 * A bundle is a JSON file in `bundles/` next to this index (generate one with
 * `node scripts/prepare-stroke-font.mjs`). Adding a font means dropping the
 * bundle there and adding it to the matching section below; removing a line
 * takes the font out of the picker, the canvas and the writing animation at
 * once. The archives the bundles were made from are kept in `sources/`, and
 * `LICENSES.md` records what each one may be used for.
 *
 * Order is the order the font picker shows, and the order other faces are
 * searched when a chosen font is missing a glyph — so the Latin handwriting
 * fonts, whose punctuation matches the rest of the ink, come before the CJK
 * families that only ever act as donors.
 */

/* Tegaki stroke originals; the first entry is the app's default face. */
import polanStronkJson from './bundles/polan-stronk.json'
import akrobatJson from './bundles/akrobat.json'
import bilehaJson from './bundles/bileha.json'
import blazebergJson from './bundles/blazeberg.json'
import booneJson from './bundles/boone.json'
import danymekaJson from './bundles/danymeka.json'
import gixelJson from './bundles/gixel.json'
import goldenAvocadoJson from './bundles/golden-avocado.json'
import mestikaJson from './bundles/mestika.json'
import emsAllureJson from './bundles/ems-allure.json'
import hersheyScriptJson from './bundles/hershey-script.json'

/* Google handwriting faces. */
import caveatJson from './bundles/caveat.json'
import italiannoJson from './bundles/italianno.json'
import tangerineJson from './bundles/tangerine.json'
import parisienneJson from './bundles/parisienne.json'
import suezOneJson from './bundles/suez-one.json'
import amiriJson from './bundles/amiri.json'
import atmaJson from './bundles/atma.json'
import tillanaJson from './bundles/tillana.json'

/* Converted from the supplied archives in sources/. */
import ltSerifJson from './bundles/lt-serif.json'
import rogboldJson from './bundles/rogbold.json'
import simpleThingsJson from './bundles/simple-things.json'
import siramanJson from './bundles/siraman.json'
import skrineJson from './bundles/skrine.json'
import waffleMangoJson from './bundles/waffle-mango.json'

/* Wide-coverage faces, used mainly as donors for CJK and punctuation. */
import kleeOneJson from './bundles/klee-one.json'
import nanumPenScriptJson from './bundles/nanum-pen-script.json'
import lxgwWenkaiJson from './bundles/lxgw-wenkai.json'

export const BUNDLED_STROKE_FONTS: StrokeFontBundle[] = [
  polanStronkJson,
  akrobatJson,
  bilehaJson,
  blazebergJson,
  booneJson,
  danymekaJson,
  gixelJson,
  goldenAvocadoJson,
  mestikaJson,
  emsAllureJson,
  hersheyScriptJson,
  caveatJson,
  italiannoJson,
  tangerineJson,
  parisienneJson,
  suezOneJson,
  amiriJson,
  atmaJson,
  tillanaJson,
  ltSerifJson,
  rogboldJson,
  simpleThingsJson,
  siramanJson,
  skrineJson,
  waffleMangoJson,
  kleeOneJson,
  nanumPenScriptJson,
  lxgwWenkaiJson
] as unknown as StrokeFontBundle[]
