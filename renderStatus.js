const Pageres = require('pageres');
const jsdom = require("jsdom");
var serializeDocument = require("jsdom").serializeDocument;
const { JSDOM } = jsdom;
const fs = require('fs');



/*const pageres = new Pageres({delay: 2})
	.src('garbage.html', ['600x1080'], {crop: true})
	.dest('./')
	.run()
	.then(() => console.log('done'));
*/
function renderPage(team, players) {
	let teamName = team["name"];
	let uniqueID = team["telegramID"];
	let template = fs.readFileSync('template.html');
	const dom = new JSDOM(template);
	const window = dom.window;
	var $ = require('jquery')(window);
	$("#teamName").text(teamName);
	let str = "<tr>";
	for (let i = 0; i < players.length; i++) {
		let player = players[i];
		str += `<td width='150px'><div width='150px'><img style='margin: 0 auto; display: block; width: 140px' src='data:image/jpeg;base64, ${player['telegramUser']['photo']}' class='${player['state']['status'] === "dead" ? "dead" : ""} rounded-circle'><p style='text-align: center; font-family: hungergames'>${player['telegramUser']['firstName']}<br>${player['state']['status'] === "dead" ? "DEAD" : "Kills: " + player['state']['kills']}</p></div></td>`;
		if (i % 4 == 3) {
			str += "</tr>";
			$('#myTable > tbody:last-child').append(str);
			str = "<tr>";
		}
	}
	if (str !== "<tr>") {
		str += "</tr>";
		$('#myTable > tbody:last-child').append(str);
	}
	let html = dom.serialize()
	fs.writeFileSync(`${uniqueID}.html`, html);
	return new Pageres({delay: 2, filename: uniqueID}).src(`${uniqueID}.html`, ['690x'+(100+220*(Math.ceil(players.length / 4)))], {crop: true}).dest('./').run();
}

module.exports = renderPage;