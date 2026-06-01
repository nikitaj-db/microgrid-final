var db = require("../../config/db");
const Sequelize = db.sequelize;
const Overview = db.overview;
const Alert = db.alert;
const SolarTransducer = db.solar_transducer;
const BASEURL = "http://localhost:5002/micro";
const sequelize = db.sequelize;

async function safeFetchJson(url, defaultValue, timeoutMs = 3000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return defaultValue;
    const text = await response.text();
    if (!text) return defaultValue;
    return JSON.parse(text);
  } catch (_err) {
    return defaultValue;
  }
}

module.exports = {
  //get all overview
  getOverview: async (req, res) => {
    try {
      const overview = await Overview.findOne({
        order: [["id", "DESC"]],
        limit: 1,
      });

      const solarList = await safeFetchJson(`${BASEURL}/solar`, []);
      const solar = Array.isArray(solarList) ? solarList[0] || {} : {};

      const gensetList = await safeFetchJson(`${BASEURL}/genset`, []);
      const genset = Array.isArray(gensetList) ? gensetList[0] || {} : {};

      const mainsList = await safeFetchJson(`${BASEURL}/mains`, []);
      const mains = Array.isArray(mainsList) ? mainsList[0] || {} : {};

      const records_json = await safeFetchJson(`${BASEURL}/records`, {});

      const alertCounts = await Alert.findAll({
        attributes: [
          [
            Sequelize.fn(
              "COUNT",
              Sequelize.literal(
                "CASE WHEN LOWER(severity) = 'alert' THEN 1 END"
              )
            ),
            "alert",
          ],
          [
            Sequelize.fn(
              "COUNT",
              Sequelize.literal(
                "CASE WHEN LOWER(severity) = 'shutdown' THEN 1 END"
              )
            ),
            "shutdown",
          ],
        ],
        raw: true,
      });

      const alert = {
        alert: alertCounts[0].alert,
        shutdown: alertCounts[0].shutdown,
      };

      const result = await SolarTransducer.sequelize.query(
        `
WITH hours AS (
    SELECT 
        TO_CHAR(generated_hour, 'YYYY-MM-DD HH24:00:00') AS hour
    FROM generate_series(
        DATE_TRUNC('month', NOW()),
        NOW(),
        INTERVAL '1 hour'
    ) AS generated_hour
), 

solar_data AS (
    SELECT 
        TO_CHAR(s."createdAt", 'YYYY-MM-DD HH24:00:00') AS hour,
        MAX(s.kwh) AS solar_kwh  
    FROM solar_transducer s
    WHERE s."createdAt" >= DATE_TRUNC('month', NOW())
    GROUP BY TO_CHAR(s."createdAt", 'YYYY-MM-DD HH24:00:00')
), 

main_data AS (
    SELECT 
        TO_CHAR(m."createdAt", 'YYYY-MM-DD HH24:00:00') AS hour,
        MAX(m.kwh) AS main_kwh  
    FROM main m
    WHERE m."createdAt" >= DATE_TRUNC('month', NOW())
    GROUP BY TO_CHAR(m."createdAt", 'YYYY-MM-DD HH24:00:00')
),

savings_data AS (
    SELECT 
        h.hour,
        s.solar_kwh,
        m.main_kwh,
        CASE 
            WHEN COALESCE(ABS(s.solar_kwh - LAG(s.solar_kwh) OVER (ORDER BY h.hour)), 0) > 0 
            AND COALESCE(ABS(m.main_kwh - LAG(m.main_kwh) OVER (ORDER BY h.hour)), 0) > 0 
            THEN COALESCE(ABS(s.solar_kwh - LAG(s.solar_kwh) OVER (ORDER BY h.hour)), 0) * 6.6
            ELSE 0
        END AS savings
    FROM hours h
    LEFT JOIN solar_data s ON h.hour = s.hour
    LEFT JOIN main_data m ON h.hour = m.hour
)

SELECT 
    SUM(savings) AS total_savings
FROM savings_data
WHERE savings < 2000 AND main_kwh <> 0;
        `,
        {
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      const result_2 = await SolarTransducer.sequelize.query(
        `
WITH hours AS (
    SELECT 
        TO_CHAR(generated_hour, 'YYYY-MM-DD HH24:00:00') AS hour
    FROM generate_series(
        DATE_TRUNC('month', NOW()),
        NOW(),
        INTERVAL '1 hour'
    ) AS generated_hour
), 

solar_data AS (
    SELECT 
        TO_CHAR(s."createdAt", 'YYYY-MM-DD HH24:00:00') AS hour,
        MAX(s.kwh) AS solar_kwh  
    FROM solar_transducer s
    WHERE s."createdAt" >= DATE_TRUNC('month', NOW())
    GROUP BY TO_CHAR(s."createdAt", 'YYYY-MM-DD HH24:00:00')
), 

genset_data AS (
    SELECT 
        TO_CHAR(g."createdAt", 'YYYY-MM-DD HH24:00:00') AS hour,
        MAX(g.kwh) AS genset_kwh  
    FROM genset_transducer g
    WHERE g."createdAt" >= DATE_TRUNC('month', NOW())
    GROUP BY TO_CHAR(g."createdAt", 'YYYY-MM-DD HH24:00:00')
),


savings_data AS (
    SELECT 
        h.hour,
        s.solar_kwh,
        g.genset_kwh,
        CASE 
            WHEN COALESCE(ABS(s.solar_kwh - LAG(s.solar_kwh) OVER (ORDER BY h.hour)), 0) > 0 
            AND COALESCE(ABS(g.genset_kwh - LAG(g.genset_kwh) OVER (ORDER BY h.hour)), 0) > 0 
            THEN COALESCE(ABS(s.solar_kwh - LAG(s.solar_kwh) OVER (ORDER BY h.hour)), 0) * 18.4
            ELSE 0
        END AS savings
    FROM hours h
    LEFT JOIN solar_data s ON h.hour = s.hour
    LEFT JOIN genset_data g ON h.hour = g.hour
)

SELECT 
    SUM(savings) AS total_savings
FROM savings_data
WHERE savings < 2000 AND genset_kwh <> 0;
        `,
        {
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      const average = await SolarTransducer.sequelize.query(
        `WITH hourly_avg AS (
      -- Combine Solar, Main, Genset hourly averages
      SELECT 
        TO_CHAR("createdAt", 'Dy') AS day,
        DATE_TRUNC('hour', "createdAt") AS hour,
        AVG(
            (kw_phase1 + kw_phase2 + kw_phase3)
        ) AS avg_kW_per_hour,
        CASE 
            -- Define "last week" from previous Sunday's start to this past Saturday
            WHEN "createdAt" >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 day' - INTERVAL '7 days'
                AND "createdAt" < DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 day'
            THEN 'last_week'
            
            -- Define "current week" from this Sunday's start to now
            WHEN "createdAt" >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 day'
                AND "createdAt" <= CURRENT_TIMESTAMP
            THEN 'current_week'
        END AS week_category
        FROM (
    SELECT "createdAt",
          kw_phase1,
          kw_phase2,
          kw_phase3
    FROM solar_transducer
    UNION ALL
    SELECT "createdAt",
          kw_phase1,
          kw_phase2,
          kw_phase3
    FROM Main
    UNION ALL
    SELECT "createdAt",
          kw_phase1,
          kw_phase2,
          kw_phase3
    FROM genset_Transducer
  ) combined_sources
        WHERE "createdAt" >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 day' - INTERVAL '7 days'
            AND "createdAt" <= CURRENT_TIMESTAMP
        GROUP BY day, hour, week_category
    )

    -- Calculate total power generation for last week and current week (up to today)
        SELECT 
            day,
            ROUND(SUM(CASE WHEN week_category = 'last_week' THEN avg_kW_per_hour ELSE 0 END)::numeric, 2) AS "lastWeek",
            ROUND(SUM(CASE WHEN week_category = 'current_week' THEN avg_kW_per_hour ELSE 0 END)::numeric, 2) AS "thisWeek"
            FROM hourly_avg
            GROUP BY day
            ORDER BY ARRAY_POSITION(ARRAY['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], day);
        `,
        {
          type: Sequelize.QueryTypes.SELECT,
        }
      );

      const totalSavingsMains = Number(result?.[0]?.total_savings ?? 0);
      const totalSavingsGenset = Number(result_2?.[0]?.total_savings ?? 0);
      const savingsMainsToDate = Number(records_json?.savings_mains ?? 0);
      const savingsGensetToDate = Number(records_json?.savings_genset ?? 0);

      const s_m_permonth = isNaN(totalSavingsMains)
        ? 0
        : totalSavingsMains;
      const s_m_tillmonth =
        (isNaN(parseFloat(s_m_permonth)) ? 0 : parseFloat(s_m_permonth)) +
        (isNaN(savingsMainsToDate) ? 0 : savingsMainsToDate);

      const s_g_permonth = isNaN(totalSavingsGenset)
        ? 0
        : totalSavingsGenset;
      const s_g_tillmonth =
        (isNaN(parseFloat(s_g_permonth)) ? 0 : parseFloat(s_g_permonth)) +
        (isNaN(savingsGensetToDate) ? 0 : savingsGensetToDate);

      return res.status(200).send({
        overview: overview || {},
        solar,
        genset,
        mains,
        alert,
        s_m_permonth,
        s_m_tillmonth,
        s_g_permonth,
        s_g_tillmonth,
        average: average || [],
      });
    } catch (error) {
      return res.status(200).send({
        overview: {},
        solar: {},
        genset: {},
        mains: {},
        alert: { alert: 0, shutdown: 0 },
        s_m_permonth: 0,
        s_m_tillmonth: 0,
        s_g_permonth: 0,
        s_g_tillmonth: 0,
        average: [],
      });
    }
  },

  createOverview: async (req, res) => {
    const {
      average_power_kw,
      average_power_kva,
      mains_operated_yesterday,
      genset_operated_yesterday,
      alerts,
      shutdown,
      av_current_amp,
      average_voltagel,
      average_voltagen,
      savings,
      energy,
      solar,
      genset,
      mains,
      daily_generation,
    } = req.body;
    try {
      const overview = await Overview.create({
        average_power_kw,
        average_power_kva,
        mains_operated_yesterday,
        genset_operated_yesterday,
        alerts,
        shutdown,
        av_current_amp,
        average_voltagel,
        average_voltagen,
        savings,
        energy,
        solar,
        genset,
        mains,
        daily_generation,
      });
      return res.status(200).json(overview);
    } catch (error) {
      return res.status(400).json(error.message);
    }
  },

  //view overview by id
  viewOverview: async (req, res) => {
    const id = req.params.id;
    try {
      const overview = await Overview.findByPk(id);
      return res.status(200).send(overview);
    } catch (error) {
      return res.status(400).send(error.message);
    }
  },

  //delete overview by id
  deleteOverview: async (req, res) => {
    const id = req.params.id;
    try {
      const overview = await Overview.destroy({ where: { id: id } });

      return res.status(200).send({
        message: "Deleted Successfully",
      });
    } catch (error) {
      return res.status(400).send(error.message);
    }
  },

  //overview update by id
  updateOverview: async (req, res) => {
    const id = req.params.id;
    const {
      average_power_kw,
      average_power_kva,
      mains_operated_yesterday,
      genset_operated_yesterday,
      alerts,
      shutdown,
      av_current_amp,
      average_voltagel,
      average_voltagen,
      savings,
      energy,
      solar,
      genset,
      mains,
      daily_generation,
    } = req.body;
    try {
      const overview = await Overview.update(
        {
          average_power_kw,
          average_power_kva,
          mains_operated_yesterday,
          genset_operated_yesterday,
          alerts,
          shutdown,
          av_current_amp,
          average_voltagel,
          average_voltagen,
          savings,
          energy,
          solar,
          genset,
          mains,
          daily_generation,
        },
        {
          where: { id },
        }
      );
      return res.status(200).send({
        message: "Updated Successfully",
      });
    } catch (error) {
      return res.status(400).send(error.message);
    }
  },

  /*
  upsertOverview: async (req, res) => {
    const overviewArray = req.body;
    const id = req.params.id || null;

    try {
      const processedOverview = [];

      for (const overviewData of overviewArray) {
        const {
          average_power_kw,
          average_power_kva,
          mains_operated_yesterday,
          genset_operated_yesterday,
          ess_energy_stored,
          soc_ess,
          alerts,
          shutdown,
          av_current_amp,
          average_voltagel,
          average_voltagen,
          savings,
          energy,
          solar,
          genset,
          daily_generation,
        } = overviewData;

        try {
          const result = await sequelize.query(
            `CALL insert_update_overview(
                        :p_id,
                        :p_average_power_kw,
                        :p_average_power_kva,
                        :p_mains_operated_yesterday,
                        :p_genset_operated_yesterday,
                        :p_ess_energy_stored,
                        :p_soc_ess,
                        :p_alerts,
                        :p_shutdown,
                        :p_av_current_amp,
                        :p_average_voltagel,
                        :p_average_voltagen,
                        :p_savings,
                        :p_energy,
                        :p_solar,
                        :p_genset,
                        :p_daily_generation,
                        :result_json
                    )`,
            {
              replacements: {
                p_id: id,
                p_average_power_kw: average_power_kw,
                p_average_power_kva: average_power_kva,
                p_mains_operated_yesterday: mains_operated_yesterday,
                p_genset_operated_yesterday: genset_operated_yesterday,
                p_ess_energy_stored: ess_energy_stored,
                p_soc_ess: soc_ess,
                p_alerts: alerts,
                p_shutdown: shutdown,
                p_av_current_amp: av_current_amp,
                p_average_voltagel: average_voltagel,
                p_average_voltagen: average_voltagen,
                p_savings: JSON.stringify(savings),
                p_energy: JSON.stringify(energy),
                p_solar: JSON.stringify(solar),
                p_genset: JSON.stringify(genset),
                p_daily_generation: daily_generation,
                result_json: null,
              },
              type: sequelize.QueryTypes.RAW,
            }
          );

          const overview = result[0][0].result_json;
          const data =
            overview === null
              ? "Already saved same data in database"
              : overview;
          processedOverview.push(data);
        } catch (innerError) {
          processedOverview.push({
            error: `Failed to process data for overview: ${innerError.message}`,
          });
        }
      }

      return res.status(200).send(processedOverview);
    } catch (error) {
      console.log(error);
      return res.status(400).json(error.message);
    }
  },
  */

  getChartData: async (req, res) => {
    try {
      const { solarData, mainsData, gensetData } = await fetchData();
      const averagePowerPerHour = calculateAveragePower(
        solarData,
        mainsData,
        gensetData
      );

      res.status(200).json(averagePowerPerHour);
    } catch (error) {
      console.error("Error fetching power data:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
};

// Function to fetch data from the solar and mains APIs
async function fetchData() {
  try {
    // Fetch solar and mains data concurrently
    const [solarResponse, mainsResponse, gensetResponse] = await Promise.all([
      fetch(`${BASEURL}/solar/excel`),
      fetch(`${BASEURL}/mains/excel`),
      fetch(`${BASEURL}/genset/excel`),
    ]);

    if (!solarResponse.ok || !mainsResponse.ok || !gensetResponse.ok) {
      throw new Error("Failed to fetch data from one or both APIs");
    }

    const solarData = await solarResponse.json();
    const mainsData = await mainsResponse.json();
    const gensetData = await gensetResponse.json();

    console.log(solarData, mainsData, gensetData);

    return { solarData, mainsData, gensetData };
  } catch (error) {
    console.error("Error fetching data:", error.message);
    throw error;
  }
}

// Function to calculate average power per hour
function calculateAveragePower(solar, mains, genset) {
  const combined = {};

  // Sum up power values for each hour from solar
  solar.forEach(({ hour, kwh_reading }) => {
    if (!combined[hour])
      combined[hour] = {
        solarSum: 0,
        solarCount: 0,
        mainsSum: 0,
        mainsCount: 0,
        gensetSum: 0,
        gensetCount: 0,
      };
    combined[hour].solarSum += kwh_reading;
    combined[hour].solarCount += 1;
  });

  // Sum up power values for each hour from mains
  mains.forEach(({ hour, kwh_reading }) => {
    if (!combined[hour])
      combined[hour] = {
        solarSum: 0,
        solarCount: 0,
        mainsSum: 0,
        mainsCount: 0,
        gensetSum: 0,
        gensetCount: 0,
      };
    combined[hour].mainsSum += kwh_reading;
    combined[hour].mainsCount += 1;
  });

  // Sum up power values for each hour from mains
  genset.forEach(({ hour, kwh_reading }) => {
    if (!combined[hour])
      combined[hour] = {
        solarSum: 0,
        solarCount: 0,
        mainsSum: 0,
        mainsCount: 0,
        gensetSum: 0,
        gensetCount: 0,
      };
    combined[hour].gensetSum += kwh_reading;
    combined[hour].gensetCount += 1;
  });

  // Calculate average power for each hour
  const result = Object.keys(combined).map((hour) => {
    const data = combined[hour];
    const solarAvg = data.solarCount > 0 ? data.solarSum / data.solarCount : 0;
    const mainsAvg = data.mainsCount > 0 ? data.mainsSum / data.mainsCount : 0;
    const gensetAvg =
      data.gensetCount > 0 ? data.gensetSum / data.gensetCount : 0;
    return {
      hour: parseInt(hour),
      kwh_reading: solarAvg + mainsAvg + gensetAvg,
    };
  });

  // Sort by hour
  return result.sort((a, b) => a.hour - b.hour);
}
