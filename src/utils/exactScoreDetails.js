export const getExactScoreDetails = (participant) =>
  (participant?.pointsDetail ?? []).flatMap((phaseDetail) =>
    (phaseDetail.detail ?? [])
      .filter((detail) => detail.tipo === 'marcador')
      .map((detail, index) => ({
        id: `${participant.id}-${phaseDetail.fase}-${index}-${detail.marcador_real ?? ''}`,
        phase: phaseDetail.fase,
        teams: detail.equipos ?? [],
        realScore: detail.marcador_real ?? '',
        predictedScore: detail.marcador_predicho ?? '',
        points: detail.puntos ?? 0
      }))
  );
