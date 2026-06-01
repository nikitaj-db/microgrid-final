/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

const Mains = ({ BaseUrl }) => {
  const [data, setData] = useState({});
  const [alertsData, setAlertsData] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [shutdownCount, setShutdownCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const containerRef = useRef(null);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    let interval = null;

    const fetchPowerData = async () => {
      try {
        const response = await fetch(`${BaseUrl}/mains/excel`);
        const result = await response.json();
        //  console.log(result)
        setChartData(result);
      } catch (error) {
        console.error("Error fetching power data:", error);
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

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${BaseUrl}/mains`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      const sortedData = data.sort((a, b) => a.id - b.id);
      //  console.log(sortedData)
      setData(sortedData[sortedData.length - 1] || {});
      setLoading(false);
    } catch (error) {
      console.error("Fetch Error:", error);
      setLoading(false);
    }
    try {
      const response = await fetch(`${BaseUrl}/alert`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setAlertsData(data);
      displayCounts(data);
    } catch (error) {
      console.error("Fetch Error:", error);
    }
  };

  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(() => {
      fetchAlerts();
    }, 900000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (imageLoaded && !loading) {
      displayDataCurveGraph(chartData);
    }
  }, [imageLoaded, loading, chartData]);

  const handleImageLoad = () => {
    setImageLoaded(true); // Set image loaded to true when the image loads
  };

  const handleImageError = () => {
    console.error("Image failed to load"); // Handle image load error
  };

  const displayCounts = (data) => {
    const mainsData = data.filter((i) => i.category === "mains");
    const alerts = mainsData.filter(
      (i) => i.severity.toLowerCase() === "alert"
    );
    const shutdown = mainsData.filter(
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
    const maxValue = d3.max(data, (d) => +d.kwh_reading) || 1;

const y = d3
  .scaleLinear()
  .domain([0, maxValue])
      .nice()
      .range([height, 0]); // Note: correct order for y-scale

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
      .style("font-size", function () {
        if (width > 1000) return "18px";
        else if (width > 500) return "14px";
        else return "10px";
      });

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
          .curve(d3.curveBasis)
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
          .curve(d3.curveBasis)
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
            `Hour: ${formatAMPM(dHover.hour)}, Power: ${dHover.kwh_reading}`
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
          .curve(d3.curveBasis)
      );

      svg.select(".shadow").attr(
        "d",
        d3
          .area()
          .x((d) => x(d.hour))
          .y0(newHeight)
          .y1((d) => y(+d.kwh_reading))
          .curve(d3.curveBasis)
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
  ((Number(data?.operating_hours) || 0) / 1000) * 100;
  const total_daily_kwh = (chartData || []).reduce(
  (sum, row) => sum + (Number(row?.kwh_reading) || 0),
  0
);
  return (
    (
      <div className="p-4">
        {/* First Row Section */}
        <div className="grid grid-cols-2 gap-5">
          <div className="relative">
            <img
              id="overview-image"
              src="assets/mains.svg"
              width="100%"
              alt="overview"
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="block w-full h-full object-cover rounded-md"
            />

            <div className="absolute bottom-7 left-5 flex items-center max-w-[calc(100%-40px)] text-white">
              <div className="flex items-center">
                <div>
                  <p className="text-xs xl:text-sm 2xl:text-lg text-[#959999] pb-1 m-0">
                    Status
                  </p>
                  <p className="text-sm xl:text-base 2xl:text-xl m-0">
                    {data.voltagel_phase1 > 200 &&
                    data.voltagel_phase2 > 200 &&
                    data.voltagel_phase3 > 200 &&
                    data.kw_phase1 >= 1 &&
                    data.kw_phase2 >= 1 &&
                    data.kw_phase3 >= 1 ? (
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

          <div className="grid grid-rows-[25%_70%] gap-4">
            <div className="grid grid-cols-4 gap-2 mt-1">
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm 2xl:text-lg text-[#C37C5A] font-medium text-center">
                  Operating Hours
                </p>
                <p
                  className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-[#F3E5DE] pt-2"
                  id="operating-hours"
                >
                  {data.operating_hours} hrs
                </p>
              </div>
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm 2xl:text-lg text-[#C37C5A] font-medium text-center">
                  Total Generation
                </p>
                <p
                  className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-[#F3E5DE] pt-2"
                  id="total-generation"
                >
                  {data.kwh} kWh
                </p>
              </div>
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm 2xl:text-lg text-[#C37C5A] font-medium text-center">
                  Total Utilisation
                </p>
                <p
                  className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-[#F3E5DE] pt-2"
                  id="total-utilisation"
                >
                  {data.kwh} kWh
                </p>
              </div>
              <div className="bg-[#051E1C] rounded-lg flex flex-col items-center justify-center">
                <p className="text-xs xl:text-sm 2xl:text-lg text-[#C37C5A] font-medium text-center">
                  Total Savings
                </p>
                <p
                  className="text-lg xl:text-xl 2xl:text-2xl font-semibold text-[#F3E5DE] pt-2"
                  id="total-savings"
                >
                  INR 0
                </p>
              </div>
            </div>

            <div
              id="grid-it-rl"
              className="rounded-lg mt-2 p-4 bg-[#030F0E]"
              ref={containerRef}
            >
              <div className="flex justify-between mb-4">
                <p className="text-sm xl:text-base 2xl:text-2xl text-white">
                  Energy Generated Today
                </p>
                <p className="text-xs xl:text-sm 2xl:text-lg text-white">
                  Total Daily Generation: {total_daily_kwh} kWh
                </p>
              </div>
              {/* <p className="text-xs xl:text-sm 2xl:text-lg text-[#AFB2B2] mt-2 text-start">Updated 15 min ago</p> */}
              <div
                className="mt-4 h-[250px] xl:h-[330px]"
                id="my_dataviz"
              ></div>
            </div>
          </div>
        </div>
        {/* Second Row Section */}
        <div className="grid grid-cols-2 gap-5 mt-2 ">
          {/* Left Section */}
          <div className="grid-item-left">
            <div className="grid grid-cols-3 gap-3 mt-1">
              <div className="grid grid-rows-2 mt-2">
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 2xl:p-4 gap-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img
                      src="assets/Icons.svg"
                      alt="icon"
                      className="2xl:h-10"
                    />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base 2xl:text-xl font-semibold"
                      id="power-generated"
                      alt="image"
                    >
                      {Number(data.power_generated_yesterday)?.toFixed(2) ??
                        "0.00"}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base 2xl:text-xl text-[#AFB2B2] text-start">
                    Power Generated Yesterday(kW)
                  </p>
                </div>
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 2xl:p-4 gap-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img
                      src="assets/Icons (5).svg"
                      alt="icon"
                      className="2xl:h-10"
                    />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base 2xl:text-xl font-semibold"
                      id="hours"
                      alt="image"
                    >
                      {data.hours_operated_yesterday}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base 2xl:text-xl text-[#AFB2B2] text-start">
                    Hours Operated Yesterday
                  </p>
                </div>
              </div>

              <div className="grid grid-rows-2 mt-2">
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 2xl:p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img
                      src="assets/Icons (2).svg"
                      alt="icon"
                      className="2xl:h-10"
                    />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base 2xl:text-xl font-semibold"
                      id="utilisation"
                      alt="image"
                    >
                      {utilisation_factor.toFixed(2)}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base 2xl:text-xl text-[#AFB2B2] text-start">
                    Utilization Factor(%)
                  </p>
                </div>
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 2xl:p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img
                      src="assets/Icons (6).svg"
                      alt="icon"
                      className="2xl:h-10"
                    />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base 2xl:text-xl font-semibold"
                      id="power"
                      alt="image"
                    >
                      {data.power_factor ? data.power_factor : 0}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base 2xl:text-xl text-[#AFB2B2] text-start">
                    Power Factor
                  </p>
                </div>
              </div>

              <div className="grid grid-rows-2 mt-2">
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 2xl:p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img
                      src="assets/Icons (3).svg"
                      alt="icon"
                      className="2xl:h-10"
                    />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base 2xl:text-xl font-semibold"
                      id="frequency"
                      alt="image"
                    >
                      {data.frequency ? data.frequency : 0}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base 2xl:text-xl text-[#AFB2B2] text-start">
                    Frequency (Hz)
                  </p>
                </div>
                <div className="bg-[#051e1c] rounded-md mb-2 p-2 2xl:p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2 xl:mb-7">
                    <img
                      src="assets/Icons (4).svg"
                      alt="icon"
                      className="2xl:h-10"
                    />
                    <h6
                      className="text-[#F3E5DE] text-sm xl:text-base 2xl:text-xl font-semibold"
                      id="breakerstatus"
                      alt="image"
                    >
                      {data.voltagel_phase1 > 200 &&
                      data.voltagel_phase2 > 200 &&
                      data.voltagel_phase3 > 200 &&
                      data.kw_phase1 >= 1 &&
                      data.kw_phase2 >= 1 &&
                      data.kw_phase3 >= 1
                        ? "On"
                        : "Off"}
                    </h6>
                  </div>
                  <p className="text-sm xl:text-base 2xl:text-xl text-[#AFB2B2] text-start">
                    Breaker Status
                  </p>
                </div>
              </div>

              {/* <div className="grid grid-cols-1 mt-2">
                            <div className="bg-[#051e1c] rounded-md mb-2 p-2 py-4 flex flex-col justify-between">
                                <p className="text-sm xl:text-base 2xl:text-xl text-white">Maintenance</p>
                                <div className="m-0 p-0">
                                    <p className="text-[#7A7F7F] text-sm xl:text-base 2xl:text-xl m-0">Last date:</p>
                                    <p className="text-base xl:text-lg text-white pt-1 m-0" id="maintenance-last-date">{data.maintainance_last_date}</p>
                                </div>
                                <div className="m-0 p-0">
                                    <p className="text-[#7A7F7F] text-sm xl:text-base 2xl:text-xl m-0">Next Due:</p>
                                    <p className="text-base xl:text-lg text-white pt-1 m-0" id="next-due">{data.next_due}</p>
                                </div>
                            </div>
                        </div> */}
            </div>

            <div className="grid mt-2 rounded-md">
              <div className="grid-item-left-down mt-2 bg-[#030F0E] mb-7 rounded-md">
                <table className="table-style w-full border-collapse">
                  <thead className="bg-[#051E1C] text-[#68BFB6]">
                    <tr className="text-xs xl:text-sm 2xl:text-lg font-medium">
                      <th className="whitespace-nowrap text-center p-5 xl:p-6 2xl:p-7 rounded-tl-lg"></th>
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
                      <td className="text-center p-3 2xl:p-5 rounded-l-lg text-sm xl:text-base 2xl:text-xl">
                        L1 Phase
                      </td>
                      <td
                        id="voltage-l-l-phase1"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.voltagel_phase1}
                      </td>
                      <td
                        id="voltage-l-n-phase1"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.voltagen_phase1}
                      </td>
                      <td
                        id="current-phase1"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.current_phase1}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center p-3 2xl:p-5 rounded-l-lg text-sm xl:text-base 2xl:text-xl">
                        L2 Phase
                      </td>
                      <td
                        id="voltage-l-l-phase2"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.voltagel_phase2}
                      </td>
                      <td
                        id="voltage-l-n-phase2"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.voltagen_phase2}
                      </td>
                      <td
                        id="current-phase2"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.current_phase2}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-center p-3 2xl:p-5 rounded-bl-lg text-sm xl:text-base 2xl:text-xl">
                        L3 Phase
                      </td>
                      <td
                        id="voltage-l-l-phase3"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.voltagel_phase3}
                      </td>
                      <td
                        id="voltage-l-n-phase3"
                        className="text-center p-3 text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.voltagen_phase3}
                      </td>
                      <td
                        id="current-phase3"
                        className="text-center p-3 rounded-br-lg text-sm xl:text-base 2xl:text-xl"
                      >
                        {data.current_phase3}
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
                    <div className="mb-4 text-base xl:text-lg 2xl:text-2xl font-bold">
                      Notifications
                    </div>
                    <div className="flex">
                      <p className="flex items-center ml-4 text-[#AFB2B2] text-sm xl:text-base 2xl:text-xl">
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

                      <p className="flex items-center ml-4 text-[#AFB2B2] text-sm xl:text-base 2xl:text-xl">
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
                  className="bg-[#030F0E] rounded-lg pb-2.5 overflow-y-auto h-[240px] xl:h-[260px] 2xl:h-[350px]"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#0A3D38 #0F544C",
                  }}
                >
                  <table className="w-full border-collapse text-[#CACCCC] text-xs xl:text-sm 2xl:text-lg">
                    <thead className="bg-[#051E1C] text-left sticky top-0 z-20 text-[#68BFB6]">
                      <tr className="text-xs xl:text-sm 2xl:text-lg">
                        <th className="px-3 xl:px-4 py-2 xl:py-3 2xl:px-5 2xl:py-4 rounded-tl-lg font-medium">
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
                        .filter((i) => i.category === "mains")
                        .reverse()
                        .map((item, index) => (
                          <tr key={index}>
                            <td className="px-3 xl:px-4 py-4 2xl:py-5">
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
                    <tr className="text-xs xl:text-sm 2xl:text-lg text-center font-medium">
                      <th className="whitespace-nowrap p-4 rounded-tl-lg font-medium 2xl:p-5">
                        Power
                      </th>
                      <th className="p-2 font-medium">Phase 1</th>
                      <th className="p-2 font-medium">Phase 2</th>
                      <th className="p-2 rounded-tr-lg font-medium">Phase 3</th>
                    </tr>
                  </thead>
                  <tbody className="bg-[#030F0E] text-center text-[#CACCCC]">
                    <tr className="text-sm xl:text-base 2xl:text-xl">
                      <td className="p-4 rounded-bl-lg 2xl:p-5">kW</td>
                      <td id="kW-phase1" className="p-2">
                        {data.kw_phase1}
                      </td>
                      <td id="kW-phase2" className="p-2">
                        {data.kw_phase2}
                      </td>
                      <td id="kW-phase3" className="p-2 rounded-br-lg">
                        {data.kw_phase3}
                      </td>
                    </tr>
                    {/* <tr className='text-sm xl:text-sm 2xl:text-lg'>
                                        <td className="p-3 rounded-bl-lg">kVA</td>
                                        <td id="kVA-phase1" className="p-2">{data.kva_phase1}</td>
                                        <td id="kVA-phase2" className="p-2">{data.kva_phase2}</td>
                                        <td id="kVA-phase3" className="p-2 rounded-br-lg">{data.kva_phase3}</td>
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

export default Mains;