async function generateGlobe() {

    let width = d3.select("#map").node().getBoundingClientRect().width
    let scale = 200;
    let height = scale * 2 + 10;
    const sensitivity = 75


  
    let projection = d3.geoOrthographic()
      .scale(scale)
      .center([0, 0])
      .rotate([0,-5])
      .translate([width / 2, height / 2])
  
  
    const initialScale = projection.scale()
    let path = d3.geoPath().projection(projection)
  
    let svg = d3.select("#map")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
  
    let globe = svg.append("circle")
      .attr("fill", "#fff")
      .attr("stroke", "#000")
      .attr("stroke-width", "0.5")
      .attr("cx", width/2)
      .attr("cy", height/2)
      .attr("r", initialScale)
  
    svg.call(d3.drag().on('drag', () => {
      const rotate = projection.rotate()
      const k = sensitivity / projection.scale()
      projection.rotate([
        rotate[0] + d3.event.dx * k,
        rotate[1] - d3.event.dy * k
      ])
      path = d3.geoPath().projection(projection)
      svg.selectAll("path").attr("d", path)
    }))
      .call(d3.zoom().on('zoom', () => {
        // if(d3.event.transform.k > 0.3) {
        //   projection.scale(initialScale * d3.event.transform.k)
        //   path = d3.geoPath().projection(projection)
        //   svg.selectAll("path").attr("d", path)
        //   globe.attr("r", projection.scale())
        // }
        // else {
        //   d3.event.transform.k = 0.3
        // }
      }))
  
    let map = svg.append("g")
  
    let data = world;
  
    map.append("g")
      .attr("class", "countries" )
      .selectAll("path")
      .data(data.features)
      .enter().append("path")
      .attr("class", d => "country_" + d.properties.name.replace(" ","_"))
      .attr("d", path)
      .attr("fill", "#fff")
      .style('stroke', 'black')
      .style('stroke-width', 0.5)
      .style("opacity",1)


    
    // Ensure the plotting logic is correctly integrated
    const coordinates = [
      ];
  
    //Optional rotate
    d3.timer(function(elapsed) {
      const rotate = projection.rotate()
      const k = sensitivity / projection.scale() / 5
      projection.rotate([
        rotate[0] - 1 * k,
        rotate[1]
      ])
      path = d3.geoPath().projection(projection)
      svg.selectAll("path").attr("d", path)
      svg.selectAll("circle").attr("cx", (d) => {
        if(d) {
          return projection([d.longitude, d.latitude])[0]
        } else {
          return width / 2
        }
      })
      svg.selectAll("circle").attr("cy", (d) => {
        if(d) {
          return projection([d.longitude, d.latitude])[1]
        } else {
          return height / 2; 
        }
      })
    },200);


    // Function to plot points on the globe
    svg.append('g')
      .attr('class', 'points')
      .selectAll('circle')
      .data(coordinates) // coordinates should be an array of {longitude, latitude} objects
      .enter()
      .append('circle')
      .attr('cx', d => projection([d.longitude, d.latitude])[0])
      .attr('cy', d => projection([d.longitude, d.latitude])[1])
      .attr('idx', (d, i) => i)
      .attr('r', 3) // radius of the point
      .attr('fill', 'red'); // color of the point
}

generateGlobe()