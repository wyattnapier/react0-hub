import { useEffect, useState } from 'react';
import React from "react";
import axios from 'axios'; // handles HTTP request
import './App.css';
import dotenv from 'react-dotenv'; // make sure to install react-dotenv
import Navbar from "./Navbar.js";
import Footer from "./Footer.js";

function App() {
    // const db = process.env.MONGO_URI; // model for using .env
  const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;
  const CLIENT_SECRET = process.env.REACT_APP_CLIENT_SECRET;
  const REDIRECT_URI = process.env.REACT_APP_REDIRECT_URI;

  const AUTHORIZE = "https://accounts.spotify.com/authorize";
  const TOKEN = "https://accounts.spotify.com/api/token";
  const RESPONSE_TYPE = "token";

  const [loggedIn, setLoggedIn] = useState(false);
  const [acrosticString, setAcrosticString] = useState("Morgan!");
  const [genre, setGenre] = useState("Folk"); // eventually can use api get call to import a list of recommended genres
  const VALID_CHARS = "abcdefghijklmnopqrstuvwxyz"
  let USER_ID = null;
  let playlist_id = null;

  let access_token=localStorage.getItem("access_token"); //  keeps setting to null when form is filled out or the page reloads
  let refresh_token = localStorage.getItem("refresh_token"); // keeps resetting to null when form is filled out when page rerenders

  useEffect(() => {
    // code for when component is mounted (on page load)
    onPageLoad()
  }, []); // add dependencies to array if you want this to run more frequently

  function onPageLoad(){
    // if you haven't logged in yet:
    if ( window.location.search.length > 0 ){
        console.log("window.location.search.length > 0")
        handleRedirect();
    } else {
        // console.log("WINDOW.LOCATION.SEARCH.LENGTH <= 0 \nAccess token: " + access_token + "\nRefresh token: " + refresh_token)
        access_token = localStorage.getItem("access_token");
        if ( access_token == null ){
            // we don't have an access token so set the css display to not loggedIn?
            // !! ISSUES WITH THIS LINE !!
            // document.getElementById("tokenSection").style.display = 'block'; 
        }
    }
  }

    function handleRedirect(){
        let code = getCode();
        fetchAccessToken( code );
        window.history.pushState("", "", REDIRECT_URI); // remove param from url
        // console.log("IN HANDLE REDIRECT: \nAccess token: " + access_token + "\nRefresh token: " + refresh_token)
        setLoggedIn(true);
    }

    function getCode(){
        let code = null;
        const queryString = window.location.search;
        if ( queryString.length > 0 ){
            const urlParams = new URLSearchParams(queryString);
            code = urlParams.get('code')
        }
        return code;
    }

  function requestAuthorization(){
    // client_id = document.getElementById("clientId").value;
    // client_secret = document.getElementById("clientSecret").value;
    // localStorage.setItem("client_id", client_id);
    // localStorage.setItem("client_secret", client_secret); // In a real app you should not expose your client_secret to the user
    let url = AUTHORIZE;
    url += "?client_id=" + CLIENT_ID;
    url += "&response_type=code";
    url += "&redirect_uri=" + encodeURI(REDIRECT_URI);
    url += "&show_dialog=true";
    url += "&scope=user-read-private user-read-email user-modify-playback-state user-read-playback-position user-library-read streaming user-read-playback-state user-read-recently-played playlist-read-private playlist-modify-private playlist-modify-public";
    window.location.href = url; // Show Spotify's authorization screen
  }

  function fetchAccessToken( code ) {
    let body = "grant_type=authorization_code";
    body += "&code=" + code; 
    body += "&redirect_uri=" + encodeURI(REDIRECT_URI);
    body += "&client_id=" +  CLIENT_ID;
    body += "&client_secret=" + CLIENT_SECRET;
    callAuthorizationApi(body);
  }

  function refreshAccessToken(){
    refresh_token = localStorage.getItem("refresh_token");
    let body = "grant_type=refresh_token";
    body += "&refresh_token=" + refresh_token;
    body += "&client_id=" + CLIENT_ID;
    callAuthorizationApi(body);
  }

  function callAuthorizationApi(body){
    let xhr = new XMLHttpRequest();
    xhr.open("POST", TOKEN, true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(CLIENT_ID + ":" + CLIENT_SECRET));
    xhr.send(body);
    xhr.onload = handleAuthorizationResponse;
  }

  function handleAuthorizationResponse(){
    if ( this.status == 200 ){
        var data = JSON.parse(this.responseText);
        // console.log("JSON DATA: " + JSON.stringify(data));
        if ( data.access_token != undefined ){
            access_token = data.access_token;
            localStorage.setItem("access_token", access_token);
        }
        if ( data.refresh_token != undefined ){
            refresh_token = data.refresh_token;
            localStorage.setItem("refresh_token", refresh_token);
        }
        // console.log("IN HANDLE AUTH RESPONSE: \nAccess token: " + access_token + "\nRefresh token: " + refresh_token)
        onPageLoad();
    }
    else {
        console.log(this.responseText);
        alert(this.responseText);
    }
  }

  function logout () {
    /* 
    * can I remove data from local storage without making it crash or no?
    * This is currently a pseudo logout button, it doesn't actually do anything but change visuals tbh 
    */
    setLoggedIn(false)
    access_token = null;
    refresh_token = null;
    // console.log("logging them fools out")
  }

  ////////////////////////////////// end of authorization section //////////////////////////////////

  function callApi(method, url, body){
    return new Promise((resolve, reject) => {
      let xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);

      xhr.onload = () => {
        if(xhr.status >= 200 && xhr.status < 300) {
          // add conditionals based off of callback value?
          resolve(xhr.response);
        } else if (xhr.status == 401) {
          refreshAccessToken();
          reject(new Error(xhr.statusText));
        } else {
          console.log("ERROR")
          // console.log(xhr.responseText)
          console.log(xhr.status)
          reject(new Error(xhr.statusText));
        }
      }

      xhr.onerror = function () {
        reject(new Error('Network error'));
      };

      let jsonData = JSON.stringify(body);
      xhr.send(jsonData);
    })
  }

  // form area
  async function createPlaylist() {
    try {
      // get user_id
      let responseText = await callApi("GET", "https://api.spotify.com/v1/me", null);
      console.log("Success:", responseText);
      USER_ID = JSON.parse(responseText).id;
      console.log(USER_ID);

      // create playlist and get playlist_id
      responseText = await callApi("POST", `https://api.spotify.com/v1/users/${USER_ID}/playlists`, {
            name: "Songcrostics Playlist",
            description: "songcrostics experiment playlist description",
            public: true }
        );
      console.log("Success:", responseText);
      console.log("PLAYLIST CREATED")
      playlist_id =  JSON.parse(responseText).id;
      console.log("Playlist ID: " + playlist_id);

      // start the postLoop
      postLoop();
    } catch (error) {
      // Handle error here
      // You might want to consider refreshing the access token here
      console.error("Error:", error);
    }
  }
  
  // main loop and function of program
  // could put final tracks array in here and then post to playlist at end of the while loop
  function postLoop () {
    let currIndex = acrosticString.length-1;
    console.log("starting value of currIndex: " + currIndex)
    while(currIndex >= 0) {
      let searchChar = acrosticString.charAt(currIndex).toLowerCase();
      if (VALID_CHARS.search(searchChar) === -1) {
        currIndex--;
        continue;
      }
      searchTracks(searchChar)
      // console.log("Current char at index " + currIndex + " is : " + searchChar)
      currIndex--;
    }
  }
  
  async function searchTracks (choppedChar) {
    try {
      let responseText = await callApi("GET", `https://api.spotify.com/v1/search?q=${choppedChar}&type=track&market=US&limit=10`, null) // change offset to get more interesting results
      console.log("Success:", responseText);
      let trackIndex = 0;
      let search_data = JSON.parse(responseText);
      let searchChar = search_data.tracks.href.charAt(40); // could make this adaptive by searching for &type= then getting char at index before that
      let validTrackID = null;
      let validTrackName = null;
      while (true) { // need to come up with a solution to too few results
        let currTrack = search_data.tracks.items[trackIndex];
        if (currTrack.name.charAt(0).toLowerCase() === searchChar) {
          validTrackName = currTrack.name;
          validTrackID = currTrack.id;
          break;
        }
        trackIndex++;
        if (trackIndex >= 10) {
          break;
        }
      }
      console.log("track name: " + validTrackName + " and ID: " + validTrackID)
      // need to get playlist ID first --> playlist is being created seemingly after this runs
      let tracks = [`spotify:track:${validTrackID}`];
      console.log(tracks)
      responseText = await callApi("POST", `https://api.spotify.com/v1/playlists/${playlist_id}/tracks`, tracks);
      console.log("Success:", responseText);
    } catch (error) {
      console.log("Error: " + error)
    }
  }

  ////////////////////////////////// JSX section //////////////////////////////////

  return (
    <div>
      {/* {console.log("Access token: " + access_token + "\n Refresh token: " + refresh_token)} */}
      <Navbar/>
      <div className="app2-background">
      <div className="login-widget"> 
        {loggedIn ? (
            <div className="logged-in">
                <h3>You're logged in!</h3>
                <button onClick={logout}>Logout!</button>
                {/** using w3 schools approach below */}
                <div className="user-input">
                  {/* <form onSubmit={createPlaylist}>
                    <h3>Make some choices about your playlist: </h3>
                    <label> Enter your acrostic string:
                      <input
                        type="text"
                        name="acrosticString"
                        value={acrosticString || ""}
                        onChange={(e) => setAcrosticString(e.target.value)}
                      />
                    </label>
                    <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                      <option value=""> -- Select a Genre -- </option>
                      <option value="Alternative Rock">Alternative Rock</option>
                      <option value="Folk">Folk</option>
                      <option value="Indie pop">Indie pop</option>
                      <option value="Rock">Rock</option>
                      <option value="R&B">R&B</option>
                    </select>
                    <input type="submit" />
                  </form> */}
                  <button onClick={createPlaylist}>Create a playlist!</button> {/** backup to make sure auth and general code actually works */}
                </div>
            </div>
          ) : (
              <div className="logged-out">
                  <h3>Login to Spotify</h3>
                  <p>
                    Sign into your Spotify account to generate your first acrostic
                    playlist.
                  </p>
                  <button onClick={requestAuthorization}>Click here</button>
              </div>
          )}
          {/* <form onSubmit={searchArtists}>
            <input type="text" onChange={e => setSearchKey(e.target.value)}/>
            <button type={"submit"}>Search for Artists</button>
          </form>
          {renderArtists()} */}
        </div>
      </div>
      <Footer/>
    </div>
  );
}

export default App;