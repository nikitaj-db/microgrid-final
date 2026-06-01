/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import Chart from "chart.js/auto";

import {
  calculatePercentages,
  calculateAverageCurrent,
  calculateAverageVoltageL_L,
  calculateAverageVoltageL_N,
} from "../Components/Calculation";
import KeyValueTable from "../Components/KeyValueTable";
import MetricLineChart from "../Components/MetricLineChart";
import { FORCE_ZERO_GRAPHS, zeroSeries } from "../utils/graphOverrides";

const makeHourlySeries = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    unit: null,
    kwh: null,
    kw_total: null,
  }));
};

const EMPTY_OVERVIEW = {
  solar: {
    avg_total_generation: 0,
    kwh: 0,
  },
  genset: {
    avg_total_generation: 0,
    kwh: 0,
  },
  mains: {
    avg_total_generation: 0,
    kwh: 0,
  },
  alert: {
    alert: 0,
    shutdown: 0,
  },
  average: [],
};

const Overview = ({ BaseUrl }) => {
  const myDatavizRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const doughnutChartInstanceRef = useRef(null);
  const tooltipRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  let resizeTimeout = null;
  const [dataAverage, setDataAverage] = useState([]);
  const [alldata, setAllData] = useState(EMPTY_OVERVIEW);
  const [chartData, setChartData] = useState([]);
  const chartRef = useRef();
  const modBus = true;

  const [config, setConfig] = useState(null);

  useEffect(() => {
    fetch("/config.json")
      .then((res) => res.json())
      .then((data) => setConfig(data))
      .catch((err) => console.error("Failed to load config", err));
  }, []);

  useEffect(() => {
    let interval = null;

    const fetchPowerData = async () => {
      try {
        const response = await fetch(`${BaseUrl}/overview/chart`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const result = await response.json();
        // console.log(result)
        setChartData(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error("Error fetching power data:", error);
        setChartData([]);
      }
    };

    fetchPowerData();

    const now = new Date();
    const millisecondsUntilNextHour =
      ((60 - now.getMinutes()) * 60 - now.getSeconds()) * 1000;

    // Set timeout for the first synchronized fetch
    const initialTimeout = setTimeout(() => {
      fetchPowerData(); // Fetch at the top of the hour

      // Now set regular hourly interval
      interval = setInterval(fetchPowerData, 60 * 60 * 1000); // 1 hour
    }, millisecondsUntilNextHour);

    return () => {
      clearTimeout(initialTimeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch(`${BaseUrl}/overview`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();

      const next =
        payload && typeof payload === "object" && Object.keys(payload).length
          ? payload
          : EMPTY_OVERVIEW;

      setAllData(next);
      setDataAverage(Array.isArray(next.average) ? next.average : []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching overview:", error);
      setAllData(EMPTY_OVERVIEW);
      setDataAverage([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();

    const interval = setInterval(() => {
      fetchConfig();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const datas = {
    solar: Number(alldata?.solar?.avg_total_generation) || 0,
    genset: Number(alldata?.genset?.avg_total_generation) || 0,
    mains: Number(alldata?.mains?.avg_total_generation) || 0,
  };
  const chartdata = calculatePercentages(datas);
  const current = calculateAverageCurrent(alldata);
  const voltageL_L = calculateAverageVoltageL_L(alldata);
  const voltageL_N = calculateAverageVoltageL_N(alldata);

  const fetchData = () => {
    if (imageLoaded && !loading) {
      displayDataCurveGraph(chartData);

      //  console.log(chartdata)
      const labels = chartdata.labels;
      const values = chartdata.values;
      displayDoughnutChart(labels, values);
    }
  };

  useEffect(() => {
    fetchData();
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => fetchData(), 300);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (tooltipRef.current) {
        d3.select(tooltipRef.current).remove();
      }
    };
  }, [imageLoaded, loading, chartData]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    console.error("Image failed to load");
  };

  const displayDataCurveGraph = (data) => {
    if (!myDatavizRef.current || !myDatavizRef.current.parentElement) {
      console.error("Graph container or its parent doesn't exist.");
      return;
    }

    const margin = { top: 10, right: 20, bottom: 40, left: 20 };
    d3.select(myDatavizRef.current).selectAll("svg").remove();

    const container = myDatavizRef.current.parentElement;
    const width = container.offsetWidth - margin.left - margin.right - 60;
    const height = container.offsetHeight - margin.top - margin.bottom - 70;

    if (width <= 0 || height <= 0) {
      console.error("Container has insufficient dimensions.");
      return;
    }

    // Create SVG with proper viewBox for responsive scaling
    const svg = d3
      .select(myDatavizRef.current)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr(
        "viewBox",
        `0 0 ${width + margin.left + margin.right} ${
          height + margin.top + margin.bottom
        }`
      )
      .attr("preserveAspectRatio", "xMidYMid meet")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Calculate dynamic x-axis domain based on data
    const now = new Date();
    const currentHour = now.getHours();
    const pastHour =
      currentHour - 8 < 0 ? 24 + (currentHour - 8) : currentHour - 8;

    // Initialize scales with proper ranges from the start
    const x = d3
      .scaleLinear()
      .domain([pastHour, currentHour])
      .range([0, width]);

    const rawMax = d3.max(data, (d) => +d.kwh_reading);
    const yMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : 1;

    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([height, 0]);

    const format2 = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num.toFixed(2) : "0.00";
    };

    // Define a clip path to restrict the curve and area to the chart area
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("x", 0)
      .attr("y", 0);

    // Add axes
    svg
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(9)
          .tickSizeOuter(0)
          .tickFormat((d) => formatAMPM(d))
      )
      .selectAll("text")
      .style("fill", "white")
      .style("font-size", width > 500 ? "14px" : "10px");

    svg
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(4)
          .tickFormat(() => "")
      )
      .selectAll("text")
      .style("fill", "white");

    // Define gradient
    const gradient = svg
      .append("defs")
      .append("linearGradient")
      .attr("id", "shadowGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    gradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#0A3D38")
      .attr("stop-opacity", 0.9);

    gradient
      .append("stop")
      .attr("offset", "80%")
      .attr("stop-color", "#0A3D38")
      .attr("stop-opacity", 0);

    // Add curve
    svg
      .append("path")
      .datum(data)
      .attr("class", "curve")
      .attr("fill", "none")
      .attr("stroke", "#68BFB6")
      .attr("stroke-width", 2)
      .attr("clip-path", "url(#clip)")
      .attr(
        "d",
        d3
          .line()
          .x((d) => x(d.hour))
          .y((d) => y(+d.kwh_reading))
          .curve(d3.curveLinear)
      );

    // Add shadow beneath the curve
    svg
      .append("path")
      .datum(data)
      .attr("class", "shadow")
      .attr("fill", "url(#shadowGradient)")
      .attr("stroke-width", 0)
      .attr("clip-path", "url(#clip)")
      .attr(
        "d",
        d3
          .area()
          .x((d) => x(d.hour))
          .y0(height)
          .y1((d) => y(+d.kwh_reading))
          .curve(d3.curveLinear)
      );

    // Tooltip setup
    if (!tooltipRef.current) {
      tooltipRef.current = d3
        .select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
    }

    // Add event listeners to the curve and shadow
    svg
      .selectAll(".curve, .shadow")
      .on("mousemove", function (event) {
        const [mouseX] = d3.pointer(event);
        const bisect = d3.bisector((d) => d.hour).left;
        const xValue = x.invert(mouseX);
        const index = bisect(data, xValue);
        const dLeft = data[index - 1];
        const dRight = data[index];
        const dClosest =
          !dRight || xValue - dLeft.hour < dRight.hour - xValue
            ? dLeft
            : dRight;

        if (dClosest) {
          tooltipRef.current
            .style("opacity", 0.9)
            .html(
              `Hour: ${formatAMPM(dClosest.hour)}, Power: ${
                format2(dClosest.kwh_reading)
              }`
            )
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY - 28}px`);
        }
      })
      .on("mouseout", function () {
        tooltipRef.current.style("opacity", 0);
      });

    // Handle window resize more efficiently
    function updateDimensions() {
      if (!myDatavizRef.current?.parentElement) return;

      const newWidth =
        myDatavizRef.current.parentElement.offsetWidth -
        margin.left -
        margin.right -
        60;
      const newHeight =
        myDatavizRef.current.parentElement.offsetHeight -
        margin.top -
        margin.bottom -
        70;

      if (newWidth <= 0 || newHeight <= 0) return;

      // Update SVG dimensions and viewBox
      d3.select(myDatavizRef.current)
        .select("svg")
        .attr("width", newWidth + margin.left + margin.right)
        .attr("height", newHeight + margin.top + margin.bottom)
        .attr(
          "viewBox",
          `0 0 ${newWidth + margin.left + margin.right} ${
            newHeight + margin.top + margin.bottom
          }`
        );

      // Update scales
      x.range([0, newWidth]);
      y.range([newHeight, 0]);

      // Update axes
      svg
        .select(".x-axis")
        .attr("transform", `translate(0, ${newHeight})`)
        .call(
          d3
            .axisBottom(x)
            .ticks(9)
            .tickSizeOuter(0)
            .tickFormat((d) => formatAMPM(d))
        )
        .selectAll("text")
        .style("fill", "white")
        .style("font-size", newWidth > 500 ? "14px" : "10px");

      svg.select(".y-axis").call(
        d3
          .axisLeft(y)
          .ticks(5)
          .tickSize(4)
          .tickFormat(() => "")
      );

      // Update clipPath
      svg
        .select("clipPath rect")
        .attr("width", newWidth)
        .attr("height", newHeight);

      // Update curve and shadow
      svg.select(".curve").attr(
        "d",
        d3
          .line()
          .x((d) => x(d.hour))
          .y((d) => y(+d.kwh_reading))
          .curve(d3.curveLinear)
      );

      svg.select(".shadow").attr(
        "d",
        d3
          .area()
          .x((d) => x(d.hour))
          .y0(newHeight)
          .y1((d) => y(+d.kwh_reading))
          .curve(d3.curveLinear)
      );
    }

    // Add resize event listener
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("resize", updateDimensions);
    };
  };

  function formatAMPM(hour) {
    return hour >= 12
      ? hour === 12
        ? "12 PM"
        : hour - 12 + " PM"
      : hour === 0
      ? "12 AM"
      : hour + " AM";
  }

  const displayDoughnutChart = (labels, values) => {
    if (!doughnutChartRef.current) return;
    if (doughnutChartInstanceRef.current) {
      doughnutChartInstanceRef.current.destroy();
    }
    const ctx = doughnutChartRef.current.getContext("2d");
    doughnutChartInstanceRef.current = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: [
              "rgba(243, 165, 49, 1)",
              "rgba(176, 197, 164, 1)",
              "rgba(242, 193, 141, 1)",
            ],
            borderColor: [
              "rgba(243, 165, 49, 1)",
              "rgba(176, 197, 164, 1)",
              "rgba(242, 193, 141, 1)",
            ],
            borderWidth: 1,
            cutout: "70%",
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    });
  };

  const images = [
    {
      src: "assets/image 13.png",
      label: "SOLAR",
      hours: !loading && alldata.solar.operating_hours,
      generations: !loading && alldata.solar.kwh,
      status:
        !loading &&
        alldata.solar.voltagel_phase1 > 200 &&
        !loading &&
        alldata.solar.voltagel_phase2 > 200 &&
        !loading &&
        alldata.solar.voltagel_phase3 > 200 &&
        !loading &&
        alldata.solar.kw_phase1 >= 1 &&
        !loading &&
        alldata.solar.kw_phase2 >= 1 &&
        !loading &&
        alldata.solar.kw_phase3 >= 1
          ? "active"
          : "inactive",
    },
    {
      src: "assets/image 14.png",
      label: "MAINS",
      hours: !loading && alldata.mains.operating_hours,
      generations: !loading && alldata.mains.kwh,
      status:
        !loading &&
        alldata.mains.voltagel_phase1 > 200 &&
        !loading &&
        alldata.mains.voltagel_phase2 > 200 &&
        !loading &&
        alldata.mains.voltagel_phase3 > 200 &&
        !loading &&
        alldata.mains.kw_phase1 >= 1 &&
        !loading &&
        alldata.mains.kw_phase2 >= 1 &&
        !loading &&
        alldata.mains.kw_phase3 >= 1
          ? "active"
          : "inactive",
    },
    {
      src: "assets/image 15.png",
      label: "GENSET",
      hours: !loading && alldata.genset.operating_hours,
      generations: !loading && alldata.genset.kwh,
      status:
        !loading &&
        alldata.genset.voltagel_phase1 > 200 &&
        !loading &&
        alldata.genset.voltagel_phase2 > 200 &&
        !loading &&
        alldata.genset.voltagel_phase3 > 200 &&
        !loading &&
        alldata.genset.kw_phase1 >= 1 &&
        !loading &&
        alldata.genset.kw_phase2 >= 1 &&
        !loading &&
        alldata.genset.kw_phase3 >= 1
          ? "active"
          : "inactive",
    },
  ];

  useEffect(() => {
    if (!loading) {
      d3.select(chartRef.current).selectAll("*").remove();

      const container = chartRef.current;
      const margin = { top: 30, right: 20, bottom: 70, left: 50 };
      const width = container.offsetWidth - margin.left - margin.right;
      const height = container.offsetHeight - margin.top - margin.bottom;

      const svg = d3
        .select(chartRef.current)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3
        .scaleBand()
        .domain(dataAverage.map((d) => d.day))
        .range([0, width])
        .padding(0.5);
      const y = d3.scaleLinear().domain([0, 3000]).nice().range([height, 0]);

      // Gridlines
      const gridLines = (g, axis) => {
        g.call(axis)
          .selectAll("line")
          .attr("stroke", "#565656")
          .attr("stroke-dasharray", "4");
        g.selectAll(".domain").remove();
      };

      svg
        .append("g")
        .call(
          gridLines,
          d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat("")
        );
      svg
        .append("line")
        .attr("x1", 0)
        .attr("x2", 0)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#565656")
        .attr("stroke-dasharray", "4");
      svg
        .append("line")
        .attr("x1", width)
        .attr("x2", width)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#565656")
        .attr("stroke-dasharray", "4");
      svg
        .append("g")
        .attr("transform", `translate(0,${height})`)
        .call(gridLines, d3.axisBottom(x).tickSize(-height).tickFormat(""));

      svg
        .append("g")
        .selectAll("text")
        .data([0, 1000, 2000, 3000])
        .enter()
        .append("text")
        .attr("x", -10)
        .attr("y", (d) => y(d))
        .attr("text-anchor", "end")
        .attr("alignment-baseline", "middle")
        .attr("fill", "#aaaaaa")
        .style("font-size", "14px")
        .text((d) => (d === 0 ? "0" : d / 1000 + "K"));

      if (!tooltipRef.current) {
        tooltipRef.current = d3
          .select("body")
          .append("div")
          .attr("class", "tooltip")
          .style("opacity", 0);
      }

      // Bar setup
      const barWidth = x.bandwidth() / 2.5;
      const barGroups = svg
        .selectAll(".bar-group")
        .data(dataAverage)
        .enter()
        .append("g")
        .attr("transform", (d) => `translate(${x(d.day)},0)`);

      const createBar = (barClass, dataKey, color, xOffset) => {
        barGroups
          .filter((d) => d[dataKey] > 0)
          .append("rect")
          .attr("class", barClass)
          .attr("x", xOffset)
          .attr("y", (d) => y(d[dataKey]))
          .attr("width", barWidth)
          .attr("height", (d) => height - y(d[dataKey]))
          .attr("fill", color)
          .attr("rx", 5)
          .attr("ry", 5)
          .on("mousemove", function (event, d) {
            const [mouseX] = d3.pointer(event);

            if (d) {
              tooltipRef.current
                .style("opacity", 0.9)
                .html(`<strong>${d.day}</strong>: ${d[dataKey]}`)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 28}px`);
            }
          })
          .on("mouseout", function () {
            tooltipRef.current.style("opacity", 0);
          });
      };

      // Draw bars
      createBar("bar last-week", "lastWeek", "#565656", (d) =>
        d.thisWeek === 0
          ? (x.bandwidth() - barWidth) / 2
          : (x.bandwidth() - barWidth * 2) / 3
      );
      createBar("bar this-week", "thisWeek", "#51C18B", (d) =>
        d.lastWeek === 0
          ? (x.bandwidth() - barWidth) / 2
          : (x.bandwidth() - barWidth * 2) / 3 +
            barWidth +
            (x.bandwidth() - barWidth * 2) / 3
      );

      // X-axis labels
      svg
        .append("g")
        .attr("transform", `translate(0,${height + 20})`)
        .selectAll("text")
        .data(dataAverage)
        .enter()
        .append("text")
        .attr("x", (d) => x(d.day) + x.bandwidth() / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#ffffff")
        .style("font-size", "12px")
        .text((d) => d.day);

      // Legend setup
      const legend = svg
        .append("g")
        .attr("transform", `translate(${width - 190}, ${height + 45})`);

      const createLegendItem = (xPos, color, text, gap = 0) => {
        legend
          .append("rect")
          .attr("x", xPos + gap)
          .attr("y", 0)
          .attr("width", 16)
          .attr("height", 16)
          .attr("fill", color);

        legend
          .append("text")
          .attr("x", xPos + 20 + gap)
          .attr("y", 12)
          .attr("fill", "#ffffff")
          .style("font-size", "14px")
          .text(text);
      };

      const gapBetweenItems = 10;

      createLegendItem(-20, "#565656", "Last Week");
      createLegendItem(100 + gapBetweenItems, "#51C18B", "This Week");
    }
  }, [loading, dataAverage]);

  const colors = [
    "rgba(243,165,49,1)",
    "rgba(176,197,164,1)",
    "rgba(242,193,141,1)",
  ];

  const saving =
    !loading &&
    0.5 * alldata.solar.kwh -
      (17 * alldata.mains.kwh + 25 * alldata.genset.kwh);
  const before_yesterday_data =
    !loading &&
    alldata.solar.power_generated_before_yesterday +
      alldata.mains.power_generated_before_yesterday +
      alldata.genset.power_generated_before_yesterday;
  const yesterday_data =
    !loading &&
    alldata.solar.power_generated_yesterday +
      alldata.mains.power_generated_yesterday +
      alldata.genset.power_generated_yesterday;
  const average_power_kwh =
    !loading && (before_yesterday_data - yesterday_data) / 24;

  const total_generation =
    !loading &&
    alldata.solar.avg_daily_total_generation +
      alldata.mains.avg_daily_total_generation;
  const total_daily_kwh =
    !loading && chartData.reduce((sum, row) => sum + row.kwh_reading, 0);
  const totalThisWeek =
    !loading &&
    dataAverage.reduce((sum, day) => sum + parseFloat(day.thisWeek), 0);

  return loading ? (
    <div className="flex justify-center items-center h-full">
      <div className="loader"></div>
    </div>
  ) : (
    <div className="p-4">
      {/* First Row Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {/* Left Section */}
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 transition-transform duration-500 gap-5 xl:gap-5 h-[45vh]">
            {images.map((image, index) => (
              <div key={index} className="relative w-full overflow-hidden">
                <img
                  src={image.src}
                  alt={image.label}
                  className="object-cover rounded-lg w-full h-full "
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
                {image.status === "active" && (
                  <div className="absolute rounded-lg inset-0 bg-[linear-gradient(to_bottom,#199E2E12,#199E2E80)] opacity-70"></div>
                )}
                <div className="absolute -top-1 -right-1 transform translate-x-[-20%] translate-y-[20%] p-2 bg-transparent text-white rounded-md z-10 flex items-center max-w-[calc(100%-40px)] ">
                  <div className="flex items-center">
                    <div>
                      {image.status === "active" ? (
                        <div className="flex items-center gap-2">
                          <div className="bg-[#30F679] rounded-full w-4 h-4"></div>
                          <div className="text-[#30F679] font-medium">
                            Active
                          </div>
                        </div>
                      ) : // If inactive, check modBus status
                      !modBus ? (
                        <div className="flex items-center gap-2">
                          <div className="bg-red-500 rounded-full w-4 h-4"></div>
                          <div className="text-red-500 font-medium">
                            Modbus Off
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="bg-[#DBDBDB] rounded-full w-4 h-4"></div>
                          <div className="text-[#DBDBDB] font-medium">
                            Inactive
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-[15%] left-[20%] transform translate-x-[-20%] translate-y-[20%] p-2 bg-transparent text-white rounded z-10 w-[90%] flex flex-col">
                  <div className="font-bold text-xl">{image.label}</div>
                  <div className="flex justify-between mt-3 text-sm">
                    <p>Hours:</p>
                    <p>{image.hours}</p>
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <p>Consumptions:</p>
                    <p>{image.generations}</p>
                  </div>
                  {/* Conditional "Modbus is off" message at the bottom */}
                  {/* {image.status === 'inactive' && !modBus && (
                                        <div className="mt-2 text-sm text-red-500 font-semibold drop-shadow">
                                            <p>Modbus is off</p>
                                        </div>
                                    )} */}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Section */}
        <div className="rounded mt-2 p-4 bg-[#030F0E]" id="grid-it-rl2">
          <div className="flex justify-between mb-4">
            <h5 className="text-base xl:text-lg text-white">
              Energy Consumed Today
            </h5>
            {/* <p className="text-[#7A7F7F] text-sm xl:text-base font-normal">Updated 15 min ago</p> */}
          </div>

          <p className="mt-2 text-white text-base xl:text-lg font-light mb-5">
            Total Daily Consumption:
            <span className="bg-[#0821FF] text-sm xl:text-base rounded-full px-3 py-1 ml-2 inline-block font-extralight">
              {(Number(total_daily_kwh) || 0).toFixed(2)} kWh
            </span>
          </p>
          <div className="mt-4 h-full">
            <div
              id="my_dataviz"
              ref={myDatavizRef}
              className="flex-1 h-full"
            ></div>
          </div>
        </div>
      </div>
      {/* Second Row Section */}
      <div className="grid grid-cols-[35.5%_63%] gap-4 pt-2">
        <div className="pie">
          <div className="text-white flex mb-5 text-lg xl:text-xl">
            Energy Consumption Comparison
          </div>

          <div className="bg-[#051e1c] rounded-lg h-[82%] pt-2">
            <div className="flex justify-center items-center w-[200px] h-[200px] relative mx-auto">
              <canvas
                id="myChart"
                ref={doughnutChartRef}
                className="w-full h-full"
                width={180}
                height={180}
              ></canvas>
            </div>

            <div className="flex items-center p-4 justify-around">
              {chartdata.labels.map((label, index) => (
                <div
                  key={index}
                  className="flex flex-col justify-around gap-5 mr-5"
                >
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 mr-2"
                      style={{ backgroundColor: colors[index] }}
                    ></div>
                    <span className="text-[#CACCCC] whitespace-nowrap">
                      {`${label} (${chartdata.values[index]}%)`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="text-white flex mb-2 text-lg xl:text-xl ">
            Energy Resources
          </div>
          <div className="grid-item-left-down2 text-white">
            <table className="table-auto w-full border-separate border-spacing-y-3">
              <thead className="text-base xl:text-lg font-light">
                <tr>
                  <td className="whitespace-nowrap pb-2">Energy Source</td>
                  <td className="pb-2">Operating Hours</td>
                  <td className="pb-2">Power Consumed</td>{" "}
                  {/* 1st row kwh - current kwh value needed to be changed */}
                  <td className="pb-2">Cost</td>
                </tr>
              </thead>
              <tbody className="table-body">
                {[
                  {
                    src: "./assets/Icons.png",
                    name: "Solar",
                    hours: `${alldata.solar?.operating_hours || 0} hrs`,
                    power: `${alldata.solar.kwh_diff} kWh`,
                    cost: config.solar_cost * alldata.solar.kwh_diff,
                    costColor: "#57EB66",
                  },
                  {
                    src: "./assets/Icons-w.png",
                    name: "Genset",
                    hours: `${alldata.genset?.operating_hours || 0} hrs`,
                    power: alldata.genset.kwh_diff + " kWh",
                    cost: config.genset_cost * alldata.genset.kwh_diff,
                    costColor: "#EB5757",
                  },
                  {
                    src: "./assets/Icons-u.png",
                    name: "Mains",
                    hours: `${alldata.mains?.operating_hours || 0} hrs`,
                    power: alldata.mains.kwh_diff + " kWh",
                    cost: config.mains_cost * alldata.mains.kwh_diff,
                    costColor: "#EB5757",
                  },
                ].map((item, index) => (
                  <tr key={index}>
                    <td className="bg-[#051E1C] text-[#CACCCC] text-lg xl:text-xl flex items-center gap-4 p-5 rounded-tl-lg rounded-bl-lg">
                      <img src={item.src} alt={item.name} />
                      {item.name}
                    </td>
                    <td className="bg-[#051E1C] text-[#CACCCC] text-lg xl:text-xl">
                      {item.hours}
                    </td>
                    <td className="bg-[#051E1C] text-[#CACCCC] text-lg xl:text-xl">
                      {item.power}
                    </td>
                    <td
                      className="bg-[#051E1C] text-[#CACCCC] text-lg xl:text-xl rounded-tr-lg rounded-br-lg"
                      style={{ color: item.costColor }}
                    >
                      {item.cost.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Third Row Section 45.2*/}
      <div className="grid grid-cols-[35.8%_27%_17%_17%] mt-2 gap-4 mr-2">
        <div className="grid">
          <div className="bg-[#051e1c] rounded-lg flex flex-col items-center">
            <div className="flex justify-between items-center w-full p-3">
              <p className="text-base xl:text-lg font-medium text-white">
                Weekly Energy Generated
              </p>
              <p className="text-base xl:text-lg font-medium text-white">
                {totalThisWeek.toFixed(2)} kWh
              </p>
            </div>
            <div ref={chartRef} className="w-full h-full max-w-4xl"></div>
            {/* <img src="assets/Vector 3.svg" className="p-1.5 w-[200px]" alt='image' />
                        <div className="flex flex-col items-start p-1.5 gap-2">
                            <h6 id="avg-kw" className="text-white text-lg mb-1.5">{(average_power_kwh ?? 0).toFixed(2)} kWh</h6>
                            <p className="text-[#7A7F7F] text-sm xl:text-base mb-1.5">Average Power (kWh)</p>
                        </div> */}
          </div>
        </div>
        <div className="flex flex-col gap-4 justify-between">
          <div className="bg-[#051e1c] rounded-lg flex flex-col justify-between p-5">
            <div className="flex items-center">
              <img src="assets/Icons.svg" className="pr-2.5" alt="image" />
              <h6 className="text-base xl:text-lg font-medium text-white">
                Mains
              </h6>
            </div>
            <div className="flex justify-between items-start flex-row mt-5 ">
              <p className="text-[#7A7F7F] text-sm xl:text-base">
                Operated Yesterday
              </p>
              <p
                id="mains"
                className="text-[#CACCCC] text-base xl:text-lg ml-1 whitespace-nowrap"
              >
                {alldata.mains.hours_operated} Hrs
              </p>
            </div>
          </div>
          <div className="bg-[#051e1c] rounded-lg flex flex-col justify-between p-5">
            <div className="flex items-center">
              <img src="assets/Icons (2).svg" className="pr-2.5" alt="image" />
              <h6 className="text-base xl:text-lg font-medium text-white">
                Genset
              </h6>
            </div>
            <div className="flex justify-between items-start flex-row mt-5">
              <p className="text-[#7A7F7F] text-sm xl:text-base">
                Operated Yesterday
              </p>
              <p
                id="genset"
                className="text-[#CACCCC] text-base xl:text-lg ml-1 whitespace-nowrap"
              >
                {alldata.genset.hours_operated_yesterday} Hrs
              </p>
            </div>
          </div>
        </div>
        {/* <div className="flex flex-col gap-4 justify-between">
                    <div className="bg-[#051e1c] rounded-lg flex justify-start items-center p-[26px] h-full">
                        <div>
                            <svg width="60" height="60" viewBox="0 0 38 38">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#0F5B53" strokeWidth="5" strokeDasharray="100, 100" strokeLinecap="round" />
                                <path id="myPathess" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#48D0D0" strokeWidth="5" strokeDasharray={`${data.ess_energy_stored}, 100`} strokeLinecap="round" />
                                <text x="18" y="20.35" textAnchor="middle" fontSize="8px" fill="white" fontFamily="Arial" id="ess">{data.ess_energy_stored}%</text>
                            </svg>
                        </div>
                        <p className="text-sm xl:text-base text-[#CACCCC] ml-5">Energy Stored (ESS)</p>
                    </div>
                    <div className="bg-[#051e1c] rounded-lg flex justify-start items-center p-[26px] h-full">
                        <div>
                            <svg width="60" height="60" viewBox="0 0 37 37">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#0F5B53" strokeWidth="5" strokeDasharray="100, 100" strokeLinecap="round" />
                                <path id="myPathsoc" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#D8D362" strokeWidth="5" strokeDasharray={`${data.soc_ess}, 100`} strokeLinecap="round" />
                                <text x="18" y="20.35" textAnchor="middle" fontSize="8px" fill="white" fontFamily="Arial" id="soc">{data.soc_ess}%</text>
                            </svg>
                        </div>
                        <p className="text-sm xl:text-base text-[#CACCCC] ml-5">SOC (ESS)</p>
                    </div>
                </div> */}
        <div className="flex flex-col h-full">
          <div className="p-4 flex flex-col justify-evenly bg-[#051e1c] rounded-lg h-full">
            <div className="flex items-center">
              <img src="assets/dollar.svg" className="w-[35px]" alt="image" />
              <p className="text-white ml-3">
                Savings{" "}
                <span>
                  <p className="text-[#959999] mt-1.5 text-xs xl:text-sm">
                    (Solar with Mains)
                  </p>
                </span>
              </p>
            </div>
            <div className="mt-2 ml-2">
              <p id="savings" className="text-white my-1.5 text-lg xl:text-xl">
                INR{" "}
                {alldata
                  ? Math.floor(alldata.s_m_permonth).toLocaleString("en-IN")
                  : 0}
              </p>
              <p className="text-[#959999] mt-1.5 text-xs xl:text-sm">
                (this month)
              </p>
            </div>
            <div className="mt-4 ml-2">
              <p id="savingt" className="text-white my-1.5 text-lg xl:text-xl">
                INR{" "}
                {alldata
                  ? Math.floor(alldata.s_m_tillmonth).toLocaleString("en-IN")
                  : 0}
              </p>
              <p className="text-[#959999] my-1.5 text-xs xl:text-sm">
                (till day)
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-col h-full">
          <div className="p-4 flex flex-col justify-evenly bg-[#051e1c] rounded-lg h-full">
            <div className="flex items-center">
              <img src="assets/dollar.svg" className="w-[35px]" alt="image" />
              <p className="text-white ml-3">
                Savings{" "}
                <span>
                  <p className="text-[#959999] mt-1.5 text-xs xl:text-sm">
                    (Solar with Genset)
                  </p>
                </span>
              </p>
            </div>

            <div className="mt-2 ml-2">
              <p id="savings" className="text-white my-1.5 text-lg xl:text-xl">
                INR{" "}
                {alldata
                  ? Math.floor(alldata.s_g_permonth).toLocaleString("en-IN")
                  : 0}
              </p>
              <p className="text-[#959999] mt-1.5 text-xs xl:text-sm">
                (this month)
              </p>
            </div>
            <div className="mt-4 ml-2">
              <p id="savingt" className="text-white my-1.5 text-lg xl:text-xl">
                INR{" "}
                {alldata
                  ? Math.floor(alldata.s_g_tillmonth).toLocaleString("en-IN")
                  : 0}
              </p>
              <p className="text-[#959999] my-1.5 text-xs xl:text-sm">
                (till day)
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Fourth Row Section */}
      <div className="grid grid-cols-[36%_18%_44.2%] gap-4 pr-3 pb-5 mt-3.5">
        <div className="grid">
          <div className="bg-[#051e1c] rounded-lg pr-5 flex flex-col justify-evenly">
            <div className="flex items-center justify-between gap-5 ml-5">
              <div className="text-white text-start text-sm xl:text-base m-0 flex justify-start ">
                <img
                  src="assets/pink.svg"
                  className="mr-2.5 align-middle inline-block"
                  alt="Energy Icon"
                />
                Total Energy Consumed
              </div>
              <div
                className="text-white text-lg ml-2.5 m-0 md:text-base text-nowrap"
                id="total"
              >
                {(Number(alldata.solar.kwh) || 0) +
                  (Number(alldata.genset.kwh) || 0) +
                  Number(alldata.mains.kwh)}{" "}
                (kWh)
              </div>
            </div>
            <div className="mb-0">
              <div className="flex items-center justify-between ml-5 mb-3">
                <p className="text-sm xl:text-base text-[#AFB2B2] m-0">
                  From Renewable Resources
                </p>
                <p
                  className="text-sm xl:text-base text-[#AFB2B2] m-0 ml-2.5 whitespace-nowrap"
                  id="renew"
                >
                  {alldata.solar.kwh} (kWh)
                </p>
              </div>
              <div className="flex items-center justify-between ml-5 mb-0">
                <p className="text-sm xl:text-base text-[#AFB2B2] m-0">
                  From Non-Renewable Resources
                </p>
                <p
                  className="text-sm xl:text-base text-[#AFB2B2] m-0 ml-2.5 whitespace-nowrap"
                  id="non-renew"
                >
                  {(Number(alldata.genset.kwh) || 0) +
                    (Number(alldata.mains.kwh) || 0)}{" "}
                  (kWh)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-rows-2 gap-4">
          <div className="bg-[#051e1c] rounded-lg p-5 flex items-center justify-between">
            <div className="h-2.5 w-2.5 bg-[#FFAF12] rounded-full"></div>
            <p className="text-[#7A7F7F] text-base xl:text-lg">Alerts</p>
            <div className="text-white text-xl xl:text-2xl" id="alerts">
              {alldata.alert?.alert ?? 0}
            </div>
          </div>
          <div className="bg-[#051e1c] rounded-lg p-5 flex items-center justify-between">
            <div className="h-2.5 w-2.5 bg-red-600 rounded-full"></div>
            <p className="text-[#7A7F7F] text-base xl:text-lg">Shutdowns</p>
            <div className="text-white text-xl xl:text-2xl" id="shutdown">
              {alldata.alert?.shutdown ?? 0}
            </div>
          </div>
        </div>

        <div className="flex w-full gap-4">
          <div className="flex-1 bg-[#051e1c] rounded-lg p-2">
            <img
              src="assets/Icons (9).svg"
              className="p-3"
              alt="Current Icon"
            />
            <div className="flex flex-col justify-center mt-5">
              <h6
                id="av-current"
                className="text-white text-xl xl:text-2xl ml-2 mb-5 font-semibold"
              >
                {current}A
              </h6>
              <p className="text-sm xl:text-base text-[#7A7F7F] ml-2">
                Average Current (Amp.)
              </p>
            </div>
          </div>
          <div className="flex-1 bg-[#051e1c] rounded-lg p-2">
            <img
              src="assets/Icons (8).svg"
              className="p-3"
              alt="Voltage Icon"
            />
            <div className="flex flex-col justify-center mt-5">
              <h6
                id="averagel"
                className="text-white text-xl xl:text-2xl ml-2 mb-5 font-semibold"
              >
                {voltageL_L}V
              </h6>
              <p className="text-sm xl:text-base text-[#7A7F7F] ml-2">
                Avg. Voltage (L-L) (Volts)
              </p>
            </div>
          </div>
          <div className="flex-1 bg-[#051e1c] rounded-lg p-2">
            <img
              src="assets/Icons (7).svg"
              className="p-3"
              alt="Voltage Icon"
            />
            <div className="flex flex-col justify-center mt-5">
              <h6
                id="averagen"
                className="text-white text-xl xl:text-2xl ml-2 mb-5 font-semibold"
              >
                {voltageL_N}V
              </h6>
              <p className="text-sm xl:text-base text-[#7A7F7F] ml-2">
                Avg. Voltage (L-N) (Volts)
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Overview;
