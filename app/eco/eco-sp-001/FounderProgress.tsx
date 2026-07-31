import styles from "./EcoCase.module.css";

export type CampaignProgress = {
  campaignId: string;
  confirmed: number;
  target: number;
  goalReached: boolean;
  status: "collecting" | "goal_reached" | "closed";
  closesAt: string;
  displayPercent: number;
};

export default function FounderProgress({
  phase,
  campaign,
}: {
  phase: "loading" | "ready" | "failure";
  campaign: CampaignProgress | null;
}) {
  if (phase !== "ready" || !campaign) {
    return (
      <div className={styles.progressFallback}>
        <p>A campanha está em andamento.</p>
        {phase === "loading" && (
          <span className={styles.progressSkeleton} aria-hidden="true" />
        )}
      </div>
    );
  }

  if (campaign.status === "closed") return null;

  if (campaign.goalReached) {
    return (
      <div className={styles.founderProgress}>
        <strong>META DE PRODUÇÃO ATINGIDA</strong>
        <div
          className={styles.progressBar}
          role="img"
          aria-label="Meta de produção atingida"
        >
          <span style={{ width: "100%" }} />
        </div>
        <p>O lote fundador está confirmado.</p>
        <p>
          Novos investigadores ainda podem participar enquanto as inscrições
          estiverem abertas.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.founderProgress}>
      <strong>
        {campaign.confirmed} de {campaign.target} dossiês confirmados
      </strong>
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-label={`${campaign.confirmed} de ${campaign.target} dossiês confirmados`}
        aria-valuemin={0}
        aria-valuemax={campaign.target}
        aria-valuenow={campaign.confirmed}
      >
        <span style={{ width: `${campaign.displayPercent}%` }} />
      </div>
      <p>
        A produção será confirmada quando o lote atingir 100 investigadores.
      </p>
    </div>
  );
}
