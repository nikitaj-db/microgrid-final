/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import KeyValueTable from "../Components/KeyValueTable";
import MetricLineChart from "../Components/MetricLineChart";

const Solar = ({ BaseUrl }) => {
  const [data, setData] = useState({ solar: {} });
  const [alertsData, setAlertsData] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [shutdownCount, setShutdownCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef(null);
  const [chartData, setChartData] = useState([]);

  const [config, setConfig] = useState({});

  const fetchConfig = async () => {
    const config = await fetch("/config.json");
    const configJson = await config.json();
    setConfig(configJson);
  };

  useEffect(() => {
    let interval = null;
    const fetchPowerData = async () => {
      try {
        const response = await fetch(`${BaseUrl}/solar/excel`);
        const result = await response.json();
        //console.log(result)
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

 const fetchSolar = async () => {
  try {
    // Fetch solar data
    const solarResponse = await fetch(`${BaseUrl}/solar`);

    if (!solarResponse.ok) {
      throw new Error(`HTTP error! Status: ${solarResponse.status}`);
    }

    const payload = await solarResponse.json();
    const latest = Array.isArray(payload) ? payload[0] : payload?.solar || payload || {};

    setData({
      solar: latest,
    });

    // Fetch alert data
    const alertResponse = await fetch(`${BaseUrl}/alert`);

    if (!alertResponse.ok) {
      throw new Error(`HTTP error! Status: ${alertResponse.status}`);
    }

    const alertData = await alertResponse.json();

    setAlertsData(alertData);
    displayCounts(alertData);

    setLoading(false);
  } catch (error) {
    console.error("Fetch Error:", error);
    setLoading(false);
  }
};
  useEffect(() => {
    fetchSolar();
    fetchConfig();

    const interval = setInterval(() => {
      fetchSolar();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (imageLoaded && !loading) {
      displayDataCurveGraph(chartData);
    }
  }, [imageLoaded, loading, chartData]);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    console.error("Image failed to load");
  };

  const displayCounts = (data) => {
    const solarData = data.filter((i) => i.category === "solar");
    const alerts = solarData.filter(
      (i) => i.severity.toLowerCase() === "alert"
    );
    const shutdown = solarData.filter(
      (i) => i.severity.toLowerCase() === "shutdown"
    );
    setAlertCount(alerts.length);
    setShutdownCount(shutdown.length);
  };

  const displayDataCurveGraph = (data) => {
    const margin = { top: 10, right: 20, bottom: 40, left: 20 };
    d3.select(containerRef.current).selectAll("svg").remove();

    const container = containerRef.current;
    const width = container.offsetWidth - margin.left - margin.right - 60;
    const height = container.offsetHeight - margin.top - margin.bottom - 70;

    // Create SVG with proper viewBox for responsive scaling
    const svg = d3
      .select("#my_dataviz")
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
      .range([height, 0]); // Note: correct order for y-scale

    const format2 = (value) => {
      const num = Number(value);
      return Number.isFinite(num) ? num.toFixed(2) : "0.00";
    };

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
          .tickFormat((d) => "")
      )
      .selectAll("text")
      .style("fill", "white");

    // Add clipPath with explicit dimensions
    svg
      .append("defs")
      .append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("x", 0)
      .attr("y", 0);

    // Apply the gradient
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

    // Add the curve path
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

    // Add the shadow (area beneath curve)
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
          .y0(height) // Start from the bottom (X-axis line)
          .y1((d) => y(+d.kwh_reading))
          .curve(d3.curveLinear)
      );

    // Create tooltip
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    // Add event listeners
    svg
      .selectAll(".curve, .shadow")
      .on("mouseover", function (event, d) {
        const bisect = d3.bisector((d) => d.hour).right;
        const i = bisect(data, x.invert(d3.pointer(event)[0]));
        const d0 = data[i - 1];
        const d1 = data[i];
        const dHover =
          x.invert(d3.pointer(event)[0]) - d0.hour >
          d1.hour - x.invert(d3.pointer(event)[0])
            ? d1
            : d0;
        tooltip.transition().duration(200).style("opacity", 0.9);
        tooltip
          .html(
            `Hour: ${formatAMPM(dHover.hour)}, Power: ${format2(
              dHover.kwh_reading
            )}`
          )
          .style("left", event.pageX + "px")
          .style("top", event.pageY - 28 + "px");
      })
      .on("mouseout", function () {
        tooltip.transition().duration(500).style("opacity", 0);
      });

    // Handle window resize more efficiently
    function updateDimensions() {
      if (!containerRef.current) return;

      const newWidth =
        containerRef.current.offsetWidth - margin.left - margin.right - 60;
      const newHeight =
        containerRef.current.offsetHeight - margin.top - margin.bottom - 70;

      // Update SVG dimensions and viewBox
      d3.select("#my_dataviz svg")
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
          .tickFormat((d) => "")
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

  const formatAMPM = (hour) => {
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12;
    return `${formattedHour} ${ampm}`;
  };

  const utilisation_factor =
    !loading && ((Number(data.solar?.operating_hours) || 0) / 1000) * 100;
  const total_daily_kwh =
    !loading && chartData.reduce((sum, row) => sum + row.kwh_reading, 0);

  return (
    !loading && (
      <div className="p-4">
        {/* First Row Section */}
        <div className="grid grid-cols-2 gap-5">
          <div className="relative block">
            <img
              id="overview-image"
              src="assets/Mask group.svg"
              alt="overview"
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="block w-full h-full object-cover rounded-md"
            />

            <div className="absolute bottom-[7%] left-[5%] transform translate-x-[-20%] translate-y-[20%] p-2 bg-transparent text-white rounded-md z-10 flex items-center max-w-[calc(100%-40px)]">
              <div className="flex items-center">
                <div className="mr-2">
                  <img
                    src="assets/Icons (T).png"
                    className="h-10 max-h-1/2 max-w-full"
                    alt="image"
                  />
                </div>
                <div>
                  <p className="text-xs xl:text-sm text-[#959999] pb-1 m-0">
                    Total Capacity
                  </p>
                  <p className="text-sm xl:text-base m-0">140 kW</p>
                </div>
              </div>
            </div>

            <div className="absolute bottom-[7%] left-[35%] transform translate-x-[-20%] translate-y-[20%] p-2 bg-transparent text-white rounded-md z-10 flex items-center max-w-[calc(100%-40px)]">
              <div className="flex items-center">
                <div>
                  <p className="text-xs xl:text-sm text-[#959999] pb-1 m-0">
                    Status
                  </p>
                  <p className="text-sm xl:text-base m-0">
                    {Number(data.solar?.voltagel_phase1) > 200 &&
                    Number(data.solar?.voltagel_phase2) > 200 &&
                    Number(data.solar?.voltagel_phase3) > 200 &&
                    Number(data.solar?.kw_phase1) >= 1 &&
                    Number(data.solar?.kw_phase2) >= 1 &&
                    Number(data.solar?.kw_phase3) >= 1 ? (
                      <div className="flex items-center gap-2">
                        <div className="bg-[#30F679] rounded-full w-4 h-4"></div>
                        <div className="text-[#30F679]">Active</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="bg-[#DBDBDB] rounded-full w-4 h-4"></div>
                        <div className="text-[#DBDBDB]">Inactive</div>
                      </div>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-rows-[25%_70%] gap-4 flex-1">
            <div className="grid grid-cols-4 gap-2 mt-1">
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm text-[#C37C5A] font-medium text-center">
                  Operating Hours
                </p>
                <p
                  className="text-lg xl:text-xl font-semibold text-[#F3E5DE] pt-2"
                  id="operating-hours"
                >
                  {data.solar?.operating_hours} hrs
                </p>
              </div>
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm text-[#C37C5A] font-medium text-center">
                  Total Generation
                </p>
                <p
                  className="text-lg xl:text-xl font-semibold text-[#F3E5DE] pt-2"
                  id="total-generation"
                >
                  {data.solar?.kwh} kWh
                </p>
              </div>
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm text-[#C37C5A] font-medium text-center">
                  Total Utilisation
                </p>
                <p
                  className="text-lg xl:text-xl font-semibold text-[#F3E5DE] pt-2"
                  id="total-utilisation"
                >
                  {data.solar?.kwh} kWh
                </p>
              </div>
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm text-[#C37C5A] font-medium text-center">
                  Total Savings
                </p>
                <p
                  className="text-lg xl:text-xl font-semibold text-[#F3E5DE] pt-2"
                  id="total-savings"
                >
                  INR {Number(data.solar?.kwh || 0) * Number(config.solar_cost || 0)}
                </p>
              </div>
            </div>

            <div
              className="rounded-lg mt-2 p-4 bg-[#030F0E]"
              id="grid-it-rl"
              ref={containerRef}
            >
              <div className="flex justify-between mb-4">
                <h5 className="text-sm xl:text-base text-white">
                  Energy Generated Today
                </h5>
                <p className="text-white text-xs xl:text-sm font-normal">
                  Total Daily Generation: {total_daily_kwh} kWh
                </p>
              </div>
              {/* <p className="text-[#AFB2B2] text-xs xl:text-sm mt-3 ">Updated 15 min ago</p> */}
              <div
                className="mt-4 h-[250px] xl:h-[330px]"
                id="my_dataviz"
              ></div>
            </div>
          </div>
        </div>
        {/* Second Row Section */}
        <div className="grid grid-cols-2 gap-5 mt-2">
          {/* Left Section */}
          <div className="grid-item-left">
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div className="grid grid-rows-2 mt-2">
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 gap-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img src="assets/Icons.svg" alt="icon" />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base font-semibold"
                      id="power-generated"
                      alt="image"
                    >
                      {(
                        Number(data.solar?.power_generated_yesterday) || 0
                      ).toFixed(
                        2
                      )}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base text-[#AFB2B2] text-start">
                    Power Generated Yesterday(kW)
                  </p>
                </div>
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 gap-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img src="assets/Icons (5).svg" alt="icon" />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base font-semibold"
                      id="hours"
                      alt="image"
                    >
                      {data.solar?.avg_hours_operated ? data.solar?.avg_hours_operated : 0}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base text-[#AFB2B2] text-start">
                    Hours Operated Yesterday
                  </p>
                </div>
              </div>

              <div className="grid grid-rows-2 mt-2">
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img src="assets/Icons (2).svg" alt="icon" />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base font-semibold"
                      id="utilisation"
                      alt="image"
                    >
                      {utilisation_factor.toFixed(2)}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base text-[#AFB2B2] text-start">
                    Utilization Factor(%)
                  </p>
                </div>
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img src="assets/Icons (6).svg" alt="icon" />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base font-semibold"
                      id="power"
                      alt="image"
                    >
                      {data.solar?.power_factor ? data.solar?.power_factor : 0}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base text-[#AFB2B2] text-start">
                    Power Factor
                  </p>
                </div>
              </div>

              <div className="grid grid-rows-2 mt-2">
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img src="assets/Icons (3).svg" alt="icon" />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base font-semibold"
                      id="frequency"
                      alt="image"
                    >
                      {data.solar?.frequency ? data.solar?.frequency : 0}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base text-[#AFB2B2] text-start">
                    Frequency (Hz)
                  </p>
                </div>
                <div className="bg-[#051e1c] rounded-md mb-2  p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img src="assets/Icons (4).svg" alt="icon" />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base font-semibold"
                      id="breakerstatus"
                      alt="image"
                    >
                      {Number(data.solar?.voltagel_phase1) > 200 &&
                      Number(data.solar?.voltagel_phase2) > 200 &&
                      Number(data.solar?.voltagel_phase3) > 200 &&
                      Number(data.solar?.kw_phase1) >= 1 &&
                      Number(data.solar?.kw_phase2) >= 1 &&
                      Number(data.solar?.kw_phase3) >= 1
                        ? "On"
                        : "OFF"}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base text-[#AFB2B2] text-start">
                    Breaker Status
                  </p>
                </div>
              </div>
            </div>

            <div className="grid mt-2 rounded-md">
              <div className="grid-item-left-down mt-2 bg-[#030F0E] mb-7 rounded-md">
                <table className="table-style w-full border-collapse">
                  <thead className="bg-[#051E1C] text-[#68BFB6]">
                    <tr className="text-xs xl:text-sm font-medium">
                      <th className="whitespace-nowrap text-center p-5 xl:p-6 rounded-tl-lg"></th>
                      <th className="text-center font-medium">
                        Voltage (L-L)(V)
                      </th>
                      <th className="text-center font-medium">
                        Voltage (L-N)(V)
                      </th>
                      <th className="text-center rounded-tr-lg font-medium">
                        Current (Amp)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#030F0E] text-[#CACCCC]">
                    <tr>
                      <td className="text-center p-3 rounded-l-lg text-sm xl:text-base">
                        L1 Phase
                      </td>
                      <td
                        id="voltage-l-l-phase1"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.voltagel_phase1}
                      </td>
                      <td
                        id="voltage-l-n-phase1"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.voltagen_phase1}
                      </td>
                      <td
                        id="current-phase1"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.current_phase1}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center p-3 rounded-l-lg text-sm xl:text-base">
                        L2 Phase
                      </td>
                      <td
                        id="voltage-l-l-phase2"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.voltagel_phase2}
                      </td>
                      <td
                        id="voltage-l-n-phase2"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.voltagen_phase2}
                      </td>
                      <td
                        id="current-phase2"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.current_phase2}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center p-3 rounded-bl-lg text-sm xl:text-base">
                        L3 Phase
                      </td>
                      <td
                        id="voltage-l-l-phase3"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.voltagel_phase3}
                      </td>
                      <td
                        id="voltage-l-n-phase3"
                        className="text-center p-3 text-sm xl:text-base"
                      >
                        {data.solar?.voltagen_phase3}
                      </td>
                      <td
                        id="current-phase3"
                        className="text-center p-3 rounded-br-lg text-sm xl:text-base"
                      >
                        {data.solar?.current_phase3}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/* Right Section */}
          <div className="grid-item-right">
            <div className="grid-item-right-left">
              <div className="grid-item-left-down mt-2">
                <div className="p-2">
                  <div className="text-white text-[20px] flex justify-between items-start">
                    <div className="mb-3 text-base xl:text-lg font-bold">
                      Notifications
                    </div>
                    <div className="flex">
                      <p className="flex items-center ml-4 text-[#AFB2B2] text-sm xl:text-base">
                        Alert
                        <svg
                          className="ml-2"
                          width="21"
                          height="22"
                          viewBox="0 0 21 22"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="10.5" cy="11" r="10.5" fill="#41ACA1" />
                          <text
                            x="50%"
                            y="50%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="white"
                            fontSize="12"
                            fontFamily="Arial"
                            id="alertlen"
                          >
                            {alertCount}
                          </text>
                        </svg>
                      </p>
                      <p className="flex items-center ml-4 text-[#AFB2B2] text-sm xl:text-base">
                        Shutdown
                        <svg
                          className="ml-2"
                          width="21"
                          height="22"
                          viewBox="0 0 21 22"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle cx="10.5" cy="11" r="10.5" fill="#EB5757" />
                          <text
                            x="50%"
                            y="50%"
                            dominantBaseline="middle"
                            textAnchor="middle"
                            fill="white"
                            fontSize="12"
                            fontFamily="Arial"
                            id="shutdownlen"
                          >
                            {shutdownCount}
                          </text>
                        </svg>
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  className="bg-[#030F0E] rounded-lg pb-2.5 overflow-y-auto h-[240px] xl:h-[260px]"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#0A3D38 #0F544C",
                  }}
                >
                  <table className="w-full border-collapse text-[#CACCCC] text-xs xl:text-sm">
                    <thead className="bg-[#051E1C] text-left sticky top-0 z-20 text-[#68BFB6]">
                      <tr className="text-xs xl:text-sm">
                        <th className="px-3 xl:px-4 py-2 xl:py-3 rounded-tl-lg font-medium">
                          Fault Code
                        </th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Severity</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 rounded-tr-lg font-medium">
                          Date/Time
                        </th>
                      </tr>
                    </thead>
                    <tbody
                      className="bg-[#030F0E] capitalize text-[#CACCCC]"
                      id="alert-container"
                    >
                      {alertsData
                        .filter((i) => i.category === "solar")
                        .reverse()
                        .map((item, index) => (
                          <tr key={index}>
                            <td className="px-3 xl:px-4 py-4">
                              {item.fault_code}
                            </td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td
                              className={`px-3 py-3 whitespace-nowrap ${
                                item.severity.toLowerCase() === "alert"
                                  ? "severity-alert"
                                  : item.severity.toLowerCase() === "shutdown"
                                  ? "severity-shutdown"
                                  : ""
                              }`}
                            >
                              {item.severity}
                            </td>
                            <td
                              className="px-3 py-3"
                              style={{
                                color:
                                  item.status.toLowerCase() === "open"
                                    ? "#EB5757"
                                    : "#57EB66",
                              }}
                            >
                              {item.status}
                            </td>
                            <td className="px-3 py-2">{item.date_time}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid-item-left-down mt-5 bg-[#030F0E] mb-7 rounded-lg pb-0">
                <table className="table-style w-full border-collapse">
                  <thead className="thead-style bg-[#051E1C] text-[#68BFB6]">
                    <tr className="text-xs xl:text-sm text-center font-medium">
                      <th className="whitespace-nowrap p-4 rounded-tl-lg font-medium">
                        Power
                      </th>
                      <th className="p-3 font-medium">Phase 1</th>
                      <th className="p-3 font-medium">Phase 2</th>
                      <th className="p-3 rounded-tr-lg font-medium">Phase 3</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#030F0E] text-center text-[#CACCCC]">
                    <tr className="text-sm xl:text-base">
                      <td className="p-4 rounded-bl-lg">kW</td>
                      <td id="kW-phase1" className="p-2">
                        {data.solar?.kw_phase1}
                      </td>
                      <td id="kW-phase2" className="p-2">
                        {data.solar?.kw_phase2}
                      </td>
                      <td id="kW-phase3" className="p-2 rounded-br-lg">
                        {data.solar?.kw_phase3}
                      </td>
                    </tr>
                    {/* <tr className='text-sm xl:text-base'>
                                    <td className="p-3 rounded-bl-lg">kVA</td>
                                    <td id="kVA-phase1" className="p-2">{data.solar?.kva_phase1}</td>
                                    <td id="kVA-phase2" className="p-2">{data.solar?.kva_phase2}</td>
                                    <td id="kVA-phase3" className="p-2 rounded-br-lg">{data.solar?.kva_phase3}</td>
                                </tr> */}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      </div>
    )
  );
};

export default Solar;
