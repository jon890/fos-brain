import { QuartzComponent, QuartzComponentProps } from "../../quartz/components/types"
// @ts-ignore
import script from "./scripts/memoryAtlas.inline"
import style from "./styles/memoryAtlas.scss"
import { MemoryAtlasView } from "./memoryAtlasView"

const MemoryAtlas: QuartzComponent = (props: QuartzComponentProps) => <MemoryAtlasView {...props} />

MemoryAtlas.css = style
MemoryAtlas.afterDOMLoaded = script

export default (() => MemoryAtlas) satisfies () => QuartzComponent
