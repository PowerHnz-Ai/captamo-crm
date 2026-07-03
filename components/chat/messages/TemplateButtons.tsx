"use client";



import type { TemplateButton } from "@/lib/types";

import { ExternalLink, Phone } from "lucide-react";



interface TemplateButtonsProps {

  buttons?: TemplateButton[];

}



function ButtonIcon({ type }: { type: TemplateButton["type"] }) {

  if (type === "URL") return <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />;

  if (type === "PHONE_NUMBER") return <Phone className="h-3.5 w-3.5 shrink-0 opacity-80" />;

  return null;

}



export function TemplateButtons({ buttons }: TemplateButtonsProps) {

  if (!buttons?.length) return null;



  return (

    <div className="border-t border-black/10 dark:border-white/10">

      {buttons.map((button, index) => (

        <div

          key={`${button.type}-${button.text}-${index}`}

          className={`chat-template-button flex items-center justify-center gap-1.5 px-3 py-2.5 text-center text-sm ${

            index < buttons.length - 1 ? "border-b border-black/10 dark:border-white/10" : ""

          }`}

        >

          <ButtonIcon type={button.type} />

          <span>{button.text}</span>

        </div>

      ))}

    </div>

  );

}

