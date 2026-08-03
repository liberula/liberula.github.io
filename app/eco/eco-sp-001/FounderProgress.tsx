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
        <strong>META ATINGIDA</strong>
        <div
          className={styles.progressBar}
          role="img"
          aria-label="Meta da próxima missão atingida"
        >
          <span style={{ width: "100%" }} />
        </div>
        <p>A próxima missão foi autorizada.</p>
        <p>
          Novos participantes ainda podem garantir acesso fundador enquanto a
          campanha estiver aberta. Total atual: {campaign.confirmed} participantes.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.founderProgress}>
      <strong>
        {campaign.confirmed} de {campaign.target} participantes
      </strong>
      <div
        className={styles.progressBar}
        role="progressbar"
        aria-label={`${campaign.confirmed} de ${campaign.target} participantes`}
        aria-valuemin={0}
        aria-valuemax={campaign.target}
        aria-valuenow={campaign.confirmed}
      >
        <span style={{ width: `${campaign.displayPercent}%` }} />
      </div>
      <p>
        A próxima missão será autorizada quando a campanha atingir 100 participantes.
      </p>
    </div>
  );
}
