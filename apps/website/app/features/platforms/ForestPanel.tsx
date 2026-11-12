import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { NEW_TAB } from "./theme";

export type PanelAction = { label: string; href: string; external?: boolean };
export type PanelItem = { title: string; text: string };

type Props = {
  id?: string;
  title: string;
  body: string;
  /** First action is the primary button, the second an outline button. */
  actions: PanelAction[];
  items: PanelItem[];
  /** "feature": title and description. "quote": a quotation and who said it. */
  itemStyle?: "feature" | "quote";
  /** Desktop side of the list. The first column is the wider one (7fr). */
  listSide: "left" | "right";
  /** Colour of the hover rail beside each item. */
  accent: string;
};

function Actions({ actions, mobile }: { actions: PanelAction[]; mobile?: boolean }) {
  return actions.map((a, i) => (
    <ButtonLink
      key={a.label}
      href={a.href}
      size="lg"
      variant={i === 0 ? "primary" : "outline-light"}
      arrow={a.external ? "external" : true}
      className={mobile ? "w-full" : ""}
      {...(a.external ? NEW_TAB : {})}
    >
      {a.label}
    </ButtonLink>
  ));
}

/**
 * The dark closing panel on the platform pages: a call to action beside a
 * ruled list. On phones the heading comes first, then the list, then the
 * buttons at full width. Hovering an item draws a rail in the platform colour.
 */
export function ForestPanel({ id, title, body, actions, items, itemStyle = "feature", listSide, accent }: Props) {
  const listFirst = listSide === "left";
  return (
    <section id={id} className="shell mt-20 md:mt-24">
      <Reveal
        variant="scaleIn"
        amount={0.15}
        className="grid gap-8 rounded-lg bg-forest p-6 py-10 md:p-12 lg:grid-cols-[7fr_5fr] lg:gap-24 lg:p-[72px]"
      >
        <div className={`flex flex-col items-start gap-6 ${listFirst ? "lg:order-2" : "lg:order-1"}`}>
          <SplitWords text={title} className="t-h2 text-on-forest" />
          <p className="text-base leading-[26px] text-on-forest-muted">{body}</p>
          <div className="hidden flex-wrap gap-3 lg:flex">
            <Actions actions={actions} />
          </div>
        </div>

        <Stagger role="list" gap={0.1} className={listFirst ? "lg:order-1" : "lg:order-2"}>
            {items.map((it, i) => (
              <StaggerItem
                key={it.title}
                role="listitem"
                className={`group relative border-t border-line-on-forest py-5 ${
                  i === items.length - 1 ? "border-b" : ""
                }`}
              >
                  <span
                    aria-hidden
                    className="absolute -left-4 bottom-5 top-5 w-[3px] origin-top scale-y-0 rounded-full transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100 md:-left-6"
                    style={{ backgroundColor: accent }}
                  />
                  <div className="flex flex-col gap-1 transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-2">
                    {itemStyle === "quote" ? (
                      <figure className="flex flex-col gap-1">
                        <blockquote className="text-xl font-medium leading-7 text-on-forest">{it.title}</blockquote>
                        <figcaption className="text-sm text-on-forest-muted">{it.text}</figcaption>
                      </figure>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold leading-7 text-on-forest">{it.title}</h3>
                        <p className="text-base leading-6 text-on-forest-muted">{it.text}</p>
                      </>
                    )}
                  </div>
              </StaggerItem>
            ))}
        </Stagger>

        <div className="flex flex-col gap-3 lg:hidden">
          <Actions actions={actions} mobile />
        </div>
      </Reveal>
    </section>
  );
}
