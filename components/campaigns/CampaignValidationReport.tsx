"use client";



import type { SpreadsheetValidation } from "@/lib/campaign-spreadsheet";



interface CampaignValidationReportProps {

  audienceCount: number;

  excludedRecentCount?: number;

  excludedTagsCount?: number;

  excludedClassesCount?: number;

  spreadsheetValidation?: SpreadsheetValidation | null;

  invalidCount?: number;

  renderedSamples?: string[];

  importStats?: {

    created: number;

    updated: number;

    skipped: number;

  } | null;

}



export function CampaignValidationReport({

  audienceCount,

  excludedRecentCount = 0,

  excludedTagsCount = 0,

  excludedClassesCount = 0,

  spreadsheetValidation,

  invalidCount = 0,

  renderedSamples = [],

  importStats,

}: CampaignValidationReportProps) {

  const hasContent =

    audienceCount > 0 ||

    excludedRecentCount > 0 ||

    excludedTagsCount > 0 ||

    excludedClassesCount > 0 ||

    spreadsheetValidation ||

    renderedSamples.length > 0 ||

    importStats;



  if (!hasContent) return null;



  return (

    <div className="rounded-xl border border-app-accent/30 bg-app-accent/5 p-4 text-sm text-app-subtle">

      <p className="mb-2 font-medium text-app-text">Resumo antes de criar</p>



      <ul className="space-y-1">

        <li>

          <strong>{audienceCount}</strong> contatos na audiência

        </li>



        {excludedRecentCount > 0 && (

          <li className="text-amber-400">

            <strong>{excludedRecentCount}</strong> contatos excluídos por participação recente

          </li>

        )}



        {excludedTagsCount > 0 && (

          <li className="text-amber-400">

            <strong>{excludedTagsCount}</strong> contatos excluídos por tags

          </li>

        )}



        {excludedClassesCount > 0 && (

          <li className="text-amber-400">

            <strong>{excludedClassesCount}</strong> contatos excluídos por classe

          </li>

        )}



        {spreadsheetValidation && (

          <>

            <li>

              Planilha: {spreadsheetValidation.total} linhas ·{" "}

              <strong>{spreadsheetValidation.valid}</strong> válidas

              {spreadsheetValidation.invalid > 0 && (

                <span className="text-amber-400">

                  {" "}

                  · {spreadsheetValidation.invalid} inválidas

                </span>

              )}

            </li>

            {spreadsheetValidation.duplicatePhones > 0 && (

              <li className="text-amber-400">

                {spreadsheetValidation.duplicatePhones} telefone(s) duplicado(s) na planilha

              </li>

            )}

          </>

        )}



        {invalidCount > 0 && (

          <li className="text-amber-400">{invalidCount} linha(s) com telefone inválido</li>

        )}



        {importStats && (

          <li>

            Import: {importStats.created} criados, {importStats.updated} atualizados,{" "}

            {importStats.skipped} ignorados

          </li>

        )}

      </ul>



      {renderedSamples.length > 0 && (

        <div className="mt-3 space-y-2">

          <p className="text-xs font-medium uppercase text-app-muted">

            Amostra de mensagens

          </p>

          {renderedSamples.map((msg, i) => (

            <p key={i} className="rounded-lg bg-black/20 px-3 py-2 text-xs">

              {msg}

            </p>

          ))}

        </div>

      )}

    </div>

  );

}

