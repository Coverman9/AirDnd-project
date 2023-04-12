// frontend/src/components/Navigation/index.js
import React from "react";
import { Link, NavLink } from "react-router-dom";
import { useSelector } from "react-redux";
import ProfileButton from "./ProfileButton";
import CreateNewSpot from "./CreateNewSpot";
import OpenModalMenuItem from "./OpenModalMenuItem";
import "./Navigation.css";
import logo from "./moelogo.png"

function Navigation({ isLoaded }) {
  const sessionUser = useSelector((state) => state.session.user);
  // console.log("sessionUser =>",sessionUser)
  return (
    <ul className="home-ul">
      <li className="home-button">
        <NavLink exact to="/">
          <div className="logo-div">
            <img
              className="main-logo"
              src={logo}
            />
            <span className="airdnd-span">airdnd</span>
          </div>
        </NavLink>
      </li>
      {isLoaded && (
        <li className="profile-button-li">
          <div className="profile-button-div">
            <ProfileButton user={sessionUser} />
          </div>
          <div className="create-new-spot-button">
            {sessionUser && (
              <Link to={"/spots/new"}>
                <div>Create a New Spot</div>
              </Link>
            )}
          </div>
        </li>
      )}
    </ul>
  );
}

export default Navigation;
