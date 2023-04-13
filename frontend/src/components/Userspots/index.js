import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getCurrentSpotsThunk } from "../../store/spots";
import { Link } from "react-router-dom";
import { deleteSpotThunk } from "../../store/spots";

import "./Userspots.css";

const UserSpots = () => {
  const spotsObj = useSelector((state) => state.spots);
  const spots = Object.values(spotsObj);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)

  // console.log("currentsspots", spotsObj)

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(getCurrentSpotsThunk());
  }, [dispatch]);

  const deleteSpot = (e, spotId) => {
    e.preventDefault();
    dispatch(deleteSpotThunk(spotId));
  };

  return (
    <>
      <h1>Manage Your Spots</h1>
      <div className="wrapper-div">
        {spots.map((spot) => {
          return (
            <>
              <div className="spots-div">
                <Link to={`/spot/${spot.id}`}>
                  {spot.previewImage !== "No Preview Image Available" ? (
                    <img src={spot.previewImage}></img>
                  ) : (
                    <img src="https://ftcollinshomes.com/wp-content/uploads/2015/06/nophotoavailable.png"></img>
                  )}
                  <div className="spot-wrapper-div">
                    <div className="spot-info">
                      <div key={spot.id} className="spot-location">
                        {spot.name}, {spot.city}, {spot.state}
                      </div>
                      <div>${spot.price} night</div>
                    </div>

                    <div>
                      ⭐️{" "}
                      {spot.avgRating !== "No Reviews exist for this spot"
                        ? spot.avgRating
                        : "New"}
                    </div>
                  </div>
                </Link>
                <div className="update-delete-buttons">
                  <Link to={`/spots/${spot.id}/edit`}>
                    <button className="updel edit-spot-button">Update</button>
                  </Link>
                  <button
                    className="updel delete-spot-button"
                    onClick={(e) => deleteSpot(e, spot.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </>
          );
        })}
      </div>
    </>
  );
};

export default UserSpots;
