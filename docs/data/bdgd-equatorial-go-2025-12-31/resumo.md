# Estimativa legada de consumo de média tensão · Equatorial Goiás

- Unidades lidas na UCMT: 9772 (inativas ignoradas: 61)
- Unidades ativas selecionadas pelo consumo **estimado** de 600 MWh/ano ou mais: **1615**. Esse número não é uma contagem pelo consumo informado.
- Consumo informado para essas mesmas unidades: **3.661.722 MWh/ano**.
- Consumo estimado para essas mesmas unidades: **4.181.636 MWh/ano**.
- Unidades com algum mês zerado na BDGD: 1090 de 1615. Hipótese legada: tratar zeros como lacunas e preenchê-los pela média dos meses positivos quando há pelo menos 6 meses positivos. Zero também pode ser consumo real; a causa não foi comprovada.
- Os 3 setores no topo somam 49% do consumo **estimado**: 10 · Alimentos; 36 · Captação e tratamento de água; 01 · Agricultura e pecuária.

Frase para o slide: "No cenário legado, 1615 unidades selecionadas pela estimativa somam 4.181.636 MWh/ano estimados, contra 3.661.722 MWh/ano informados para as mesmas unidades. Uma redução hipotética de 10% da estimativa equivaleria a 418.164 MWh; não há comprovação de economia."

Os valores históricos foram preservados, não recalculados. Os CSVs identificam `criterio_selecao=estimativa_legada`; os totais informados por grupo ficam vazios porque não podem ser recuperados dos agregados disponíveis. É necessário baixar a BDGD original e executar novamente o script para obter a seleção pelo consumo informado. O padrão atual preserva zeros, e mesmo o cenário opcional mantém essa seleção; portanto, este conjunto não representa uma execução da versão atual.

Arquivos: por_cnae.csv, por_municipio.csv, grafico_cnae.svg, grafico_municipio.svg.
Fonte: ANEEL, Base de Dados Geográfica da Distribuidora (BDGD), camada UCMT. Dados anônimos e agregados.
